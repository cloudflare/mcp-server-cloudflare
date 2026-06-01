import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { AccountManager } from '@repo/mcp-common/src/account-manager'
import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { getProps } from '@repo/mcp-common/src/get-props'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { BASE_INSTRUCTIONS } from './radar.context'
import { registerRadarTools } from './tools/radar.tools'
import { registerUrlScannerTools } from './tools/url-scanner.tools'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './radar.context'

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// NOTE: This server is deprecated. The unified Cloudflare MCP server at
// https://mcp.cloudflare.com/mcp already covers all Radar API endpoints
// (see https://github.com/cloudflare/mcp).
//
// The deprecation notice is surfaced via the MCP `instructions` field on the
// initialize response. Humans see it in MCP-client UIs that render
// `instructions`; it is also documented in README.md and CONTRIBUTING.md.
export const DEPRECATION_INSTRUCTIONS = `⚠️ DEPRECATED: This Radar MCP server is deprecated.

The unified Cloudflare MCP server at mcp.cloudflare.com/mcp already covers all
Radar API endpoints (along with the rest of the Cloudflare API) via Code Mode —
two generic tools (\`search\` and \`execute\`) that give agents access to the full
Cloudflare API through code execution. It supports both OAuth (connect to the URL
and authorize) and Cloudflare API tokens (send as a bearer token).

Example MCP client configuration:

{
  "mcpServers": {
    "cloudflare-api": {
      "url": "https://mcp.cloudflare.com/mcp"
    }
  }
}

This Radar server continues to respond for now, but will be retired. Please
migrate at your earliest convenience.`

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps
type State = Record<string, never>

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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
	}

	async init() {
		// TODO: Probably we'll want to track account tokens usage through an account identifier at some point
		const props = getProps(this)
		const userId = props.type === 'user_token' ? props.user.id : undefined
		const accountManager = new AccountManager(props)

		this.server = new CloudflareMCPServer({
			userId,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			accountManager,
			options: {
				instructions:
					DEPRECATION_INSTRUCTIONS +
					'\n\n---\n\n' +
					BASE_INSTRUCTIONS +
					accountManager.instructionsSuffix(),
			},
		})

		registerRadarTools(this)
		registerUrlScannerTools(this)
	}
}

const RadarScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'radar:read': 'Grants access to read Cloudflare Radar data.',
	'url_scanner:write': 'Grants write level access to URL Scanner',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(RadarMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': RadarMCP.serve('/mcp'),
				'/sse': RadarMCP.serveSSE('/sse'),
			},
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
			refreshTokenTTL: 2592000, // 30 days
			// TODO: Remove after 2026-05-01 — all pre-0.4.0 grants will have expired by then
			resourceMatchOriginOnly: true,
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
