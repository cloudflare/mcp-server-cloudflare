import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerIntegrationsTools } from './tools/integrations'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

export { UserDetails }

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export type State = { activeAccountId: string | null }
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
		this.server = new CloudflareMCPServer({
			userId: this.props.user.id,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
		})

		registerAccountTools(this)
		registerIntegrationsTools(this)
	}

	async getActiveAccountId() {
		try {
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

export default new OAuthProvider({
	apiRoute: '/sse',
	// @ts-ignore
	apiHandler: CASBMCP.mount('/sse'),
	// @ts-ignore
	defaultHandler: createAuthHandlers({ scopes: CloudflareOneCasbScopes, metrics }),
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: (options) =>
		handleTokenExchangeCallback(options, env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET),
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
