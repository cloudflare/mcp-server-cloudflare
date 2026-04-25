import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import { getEnv } from '@repo/mcp-common/src/env'
import { getProps } from '@repo/mcp-common/src/get-props'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account.tools'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerBrowserTools } from './tools/browser.tools'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './browser.context'

const env = getEnv<Env>()

export { UserDetails }

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps
type State = { activeAccountId: string | null }

export class BrowserMCP extends McpAgent<Env, State, Props> {
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
		})

		registerAccountTools(this)

		// Register Cloudflare Log Push tools
		registerBrowserTools(this)
	}

}

const BrowserScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'browser:write': 'Grants write level access to Browser Rendering.',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(BrowserMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': BrowserMCP.serve('/mcp'),
				'/sse': BrowserMCP.serveSSE('/sse'),
			},
			defaultHandler: createAuthHandlers({ scopes: BrowserScopes, metrics }),
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
