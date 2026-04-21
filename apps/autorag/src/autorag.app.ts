import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import { getEnv } from '@repo/mcp-common/src/env'
import { getProps } from '@repo/mcp-common/src/get-props'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account.tools'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerAutoRAGTools } from './tools/autorag.tools'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './autorag.context'

const env = getEnv<Env>()

export { UserDetails }

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// NOTE: This server is deprecated. AutoRAG has been superseded by Cloudflare AI
// Search, and the unified Cloudflare MCP server at https://mcp.cloudflare.com/mcp
// already covers AI Search (see https://github.com/cloudflare/mcp).
//
// The deprecation notice is surfaced via the MCP `instructions` field on the
// initialize response. Humans see it in MCP-client UIs that render
// `instructions`; it is also documented in README.md and CONTRIBUTING.md.
export const DEPRECATION_INSTRUCTIONS = `⚠️ DEPRECATED: This AutoRAG MCP server is deprecated.

AutoRAG has been superseded by Cloudflare AI Search. All new work should move
to the unified Cloudflare MCP server at:

    https://mcp.cloudflare.com/mcp

That server covers the full Cloudflare API — including AI Search, which
replaces AutoRAG — via Code Mode (two generic tools: \`search\` and \`execute\`).
It supports both OAuth (connect to the URL and authorize) and Cloudflare API
tokens (send as a bearer token).

Example MCP client configuration:

    {
      "mcpServers": {
        "cloudflare-api": {
          "url": "https://mcp.cloudflare.com/mcp"
        }
      }
    }

This AutoRAG server continues to respond for now, but will be retired. Please
migrate at your earliest convenience.`

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps
type State = { activeAccountId: string | null }

export class AutoRAGMCP extends McpAgent<Env, State, Props> {
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
		const props = getProps(this)
		const userId = props.type === 'user_token' ? props.user.id : undefined

		this.server = new CloudflareMCPServer({
			userId,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			options: {
				instructions: DEPRECATION_INSTRUCTIONS,
			},
		})

		registerAccountTools(this)

		// Register Cloudflare AutoRAG tools
		registerAutoRAGTools(this)
	}

	async getActiveAccountId() {
		try {
			const props = getProps(this)
			// account tokens are scoped to one account
			if (props.type === 'account_token') {
				return props.account.id
			}
			// Get UserDetails Durable Object based off the userId and retrieve the activeAccountId from it
			// we do this so we can persist activeAccountId across sessions
			const userDetails = getUserDetails(env, props.user.id)
			return await userDetails.getActiveAccountId()
		} catch (e) {
			this.server.recordError(e)
			return null
		}
	}

	async setActiveAccountId(accountId: string) {
		try {
			const props = getProps(this)
			// account tokens are scoped to one account
			if (props.type === 'account_token') {
				return
			}
			const userDetails = getUserDetails(env, props.user.id)
			await userDetails.setActiveAccountId(accountId)
		} catch (e) {
			this.server.recordError(e)
		}
	}
}

const LogPushScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'rag:write': 'Grants write level access to AutoRag.',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(AutoRAGMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': AutoRAGMCP.serve('/mcp'),
				'/sse': AutoRAGMCP.serveSSE('/sse'),
			},
			defaultHandler: createAuthHandlers({ scopes: LogPushScopes, metrics }),
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
			refreshTokenTTL: 2592000, // 30 days
			// TODO: Remove after 2026-05-01 — all pre-0.4.0 grants will have expired by then
			resourceMatchOriginOnly: true,
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
