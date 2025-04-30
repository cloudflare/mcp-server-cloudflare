import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { handleDevMode } from '@repo/mcp-common/src/dev-mode'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerRadarTools } from './tools/radar'
import { registerUrlScannerTools } from './tools/url-scanner'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps

type State = never

export class RadarMCP extends McpAgent<Env, State, Props> {
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

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
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

		registerRadarTools(this)
		registerUrlScannerTools(this)
	}
}

// TODO add radar:read and url_scanner:write scopes once they are available
// Also remove URL_SCANNER_API_TOKEN env var
const RadarScopes = { ...RequiredScopes } as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (env.ENVIRONMENT === 'development' && env.DEV_DISABLE_OAUTH === 'true') {
			return await handleDevMode(RadarMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiRoute: ['/mcp', '/sse'],
			apiHandler: createApiHandler(RadarMCP),
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: RadarScopes, metrics }),
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
