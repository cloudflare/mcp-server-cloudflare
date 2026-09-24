import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerAuditLogTools } from './tools/auditlogs.tools'

import type { Env } from './auditlogs.context'

/** Migration guidance for users of the deprecated dedicated Audit Logs server. */
export const DEPRECATION_INSTRUCTIONS = `DEPRECATED: This dedicated Audit Logs MCP server is deprecated.

Use the Cloudflare API MCP server instead:

    https://mcp.cloudflare.com/mcp

It covers Audit Logs v2 through the full Cloudflare API, including filters and
cursor pagination for GET /accounts/{account_id}/logs/audit. Its Code Mode
search and execute tools support both OAuth and Cloudflare API tokens.

This Audit Logs server continues to respond for now, but will be retired. Please
migrate at your earliest convenience.`

const AuditlogScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'auditlogs:read': 'See your resource configuration changes.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['auditlogs-staging.mcp.cloudflare.com', 'auditlogs.mcp.cloudflare.com'],
	scopes: AuditlogScopes,
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	register: registerAuditLogTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
