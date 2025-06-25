import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account.tools'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerFindingsTools } from './tools/findings.tools'
import { registerIntegrationsTools } from './tools/integrations.tools'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './cf1-casb.context'

export { UserDetails }

const BASE_INSTRUCTIONS_CF1_CASB = `
# Cloudflare One Cloud Access Security Broker (CASB) MCP Agent

The CF1 CASB MCP Agent provides access to CF1 resources that help people understand:

- Assets across all their SaaS apps
- Security posture misconfigurations (public-facing files)


## Some common workflows people may use this for
- Clients may ask about assets as they think about them: "tell me about frank". The data is segmented around "this integration against google workspace found this user called frank". But "frank" may exist in many apps (Microsoft, Dropbox, etc). A good outcome here would be to provide a vendor-agnostic picture of "frank" and help the client reconcile a trans-vendor inventory view of their assets.
- Clients may want to dig into a specific asset's security findings. "I found this file customer_data.csv is public-facing. Can we remediate it?" Right now, you are not able to perform the remediation operation but you should have enough tools in place to print out an elegant guide a customer could follow to self-perform the remediation until we get you built to automatically handle that.


AVOID auto-selecting accounts - make sure to confirm what account before setting active account ID
ONLY rely on \`posture_findings_remediation_guide_by_finding_type_id\` to determine remediation plans. do not speculate.

## Tools

- posture_findings_remediation_guide_by_finding_type_id -- the core source of truth on how to fix findings. 
- asset_categories_ prefixed tools are good for understanding what category IDs we can get to filter.
- Example: "Tell me about frank" may consist of us looking at every asset_categories_by_type where we filter with 'user' type to see we have a few user categories (microsoft user, google workspace user, etc)
`

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps

type State = { activeAccountId: string | null }
export class CASBMCP extends McpAgent<Env, State, Props> {
	_server: CloudflareMCPServer | undefined
	set server(server: CloudflareMCPServer) {
		this._server = server
	}

	get server(): CloudflareMCPServer {
		if (!this._server) {
			throw new Error('Tried to access server before it was initialized')
		}

		return this._server
	}

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
	}

	async init() {
		// TODO: Probably we'll want to track account tokens usage through an account identifier at some point
		const userId = this.props.type === 'user_token' ? this.props.user.id : undefined

		this.server = new CloudflareMCPServer({
			userId,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			options: {
				instructions: BASE_INSTRUCTIONS_CF1_CASB,
			},
		})

		registerAccountTools(this)
		registerIntegrationsTools(this)
		registerFindingsTools(this)
	}

	async getActiveAccountId() {
		try {
			// account tokens are scoped to one account
			if (this.props.type === 'account_token') {
				return this.props.account.id
			}
			// Get UserDetails Durable Object based off the userId and retrieve the activeAccountId from it
			// we do this so we can persist activeAccountId across sessions
			const userDetails = getUserDetails(env, this.props.user.id)
			return await userDetails.getActiveAccountId()
		} catch (e) {
			this.server.recordError(e)
			return null
		}
	}

	async setActiveAccountId(accountId: string) {
		try {
			// account tokens are scoped to one account
			if (this.props.type === 'account_token') {
				return
			}
			const userDetails = getUserDetails(env, this.props.user.id)
			await userDetails.setActiveAccountId(accountId)
		} catch (e) {
			this.server.recordError(e)
		}
	}
}
const CloudflareOneCasbScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'teams:read': 'See Cloudflare One Resources',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(CASBMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': CASBMCP.serve('/mcp'),
				'/sse': CASBMCP.serveSSE('/sse'),
			},
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: CloudflareOneCasbScopes, metrics }),
			authorizeEndpoint: '/oauth/authorize',
			tokenEndpoint: '/token',
			tokenExchangeCallback: (options) =>
				handleTokenExchangeCallback(
					options,
					env.CLOUDFLARE_CLIENT_ID,
					env.CLOUDFLARE_CLIENT_SECRET
				),
			// Cloudflare access token TTL
			accessTokenTTL: 3600,
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
