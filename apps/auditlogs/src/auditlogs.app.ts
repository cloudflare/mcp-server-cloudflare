import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerAuditLogTools } from './tools/auditlogs.tools'

import type { Env } from './auditlogs.context'

const AuditlogScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'auditlogs:read': 'See your resource configuration changes.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['auditlogs-staging.mcp.cloudflare.com', 'auditlogs.mcp.cloudflare.com'],
	scopes: AuditlogScopes,
	register: registerAuditLogTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
