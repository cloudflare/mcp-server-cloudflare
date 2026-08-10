import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

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

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['radar-staging.mcp.cloudflare.com', 'radar.mcp.cloudflare.com'],
	scopes: RadarScopes,
	serverOptions: {
		instructions: `${DEPRECATION_INSTRUCTIONS}\n\n---\n\n${BASE_INSTRUCTIONS}`,
	},
	register(context) {
		registerRadarTools(context)
		registerUrlScannerTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
