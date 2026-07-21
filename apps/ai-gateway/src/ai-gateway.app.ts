import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerAIGatewayTools } from './tools/ai-gateway.tools'

import type { Env } from './ai-gateway.context'

const AIGatewayScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'aig:read': 'Grants read level access to AI Gateway.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['ai-gateway-staging.mcp.cloudflare.com', 'ai-gateway.mcp.cloudflare.com'],
	scopes: AIGatewayScopes,
	register: registerAIGatewayTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
