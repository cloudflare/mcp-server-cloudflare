import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { BASE_INSTRUCTIONS } from './radar.context'
import { registerRadarTools } from './tools/radar.tools'
import { registerUrlScannerTools } from './tools/url-scanner.tools'

import type { Env } from './radar.context'

// NOTE: This server is deprecated. The unified Cloudflare MCP server at
// https://mcp.cloudflare.com/mcp already covers all Radar API endpoints.
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

const RadarScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'radar:read': 'Grants access to read Cloudflare Radar data.',
	'url_scanner:write': 'Grants write level access to URL Scanner',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'radar-staging.mcp.cloudflare.com',
	'radar.mcp.cloudflare.com',
]
const mcpRequestPolicy = {
	allowedHostnames,
	allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
}

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	requireAuth: true,
	serverOptions: {
		instructions: `${DEPRECATION_INSTRUCTIONS}\n\n---\n\n${BASE_INSTRUCTIONS}`,
	},
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerRadarTools(context)
		registerUrlScannerTools(context)
	},
	handler: mcpRequestPolicy,
})

const apiHandler = createApiHandler(mcpHandler)

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const metrics = new MetricsTracker(env.MCP_METRICS, {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		})
		return createCloudflareOAuthRouter({
			apiHandler,
			scopes: RadarScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
