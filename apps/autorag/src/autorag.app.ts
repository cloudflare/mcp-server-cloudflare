import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

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

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['autorag-staging.mcp.cloudflare.com', 'autorag.mcp.cloudflare.com'],
	scopes: AutoRAGScopes,
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	register: registerAutoRAGTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
