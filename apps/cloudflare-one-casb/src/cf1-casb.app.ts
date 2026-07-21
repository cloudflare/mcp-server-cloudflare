import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerIntegrationsTools } from './tools/integrations.tools'

import type { Env } from './cf1-casb.context'

const CloudflareOneCasbScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'teams:read': 'See Cloudflare One Resources',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['casb-staging.mcp.cloudflare.com', 'casb.mcp.cloudflare.com'],
	scopes: CloudflareOneCasbScopes,
	register: registerIntegrationsTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
