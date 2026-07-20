import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerAutoRAGTools } from './tools/autorag.tools'

import type { Env } from './autorag.context'

// NOTE: This server is deprecated. AutoRAG has been superseded by Cloudflare AI
// Search, and the unified Cloudflare MCP server at https://mcp.cloudflare.com/mcp
// already covers AI Search (see https://github.com/cloudflare/mcp).
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

const AutoRAGScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'rag:write': 'Grants write level access to AutoRag.',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'autorag-staging.mcp.cloudflare.com',
	'autorag.mcp.cloudflare.com',
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
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register: registerAutoRAGTools,
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
			scopes: AutoRAGScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
