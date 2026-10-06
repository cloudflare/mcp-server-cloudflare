import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerAIGatewayTools } from './tools/ai-gateway.tools'

import type { Env } from './ai-gateway.context'

/** Points users of this deprecated server to the Cloudflare API MCP server. */
export const DEPRECATION_INSTRUCTIONS = `DEPRECATED: This AI Gateway MCP server is deprecated. Use the Cloudflare API MCP server at https://mcp.cloudflare.com/mcp instead. It covers the full Cloudflare API, including AI Gateway.`

const AIGatewayScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'aig:read': 'Grants read level access to AI Gateway.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serverId: 'ai-gateway',
	serviceHostnames: ['ai-gateway-staging.mcp.cloudflare.com', 'ai-gateway.mcp.cloudflare.com'],
	scopes: AIGatewayScopes,
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	register: registerAIGatewayTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
