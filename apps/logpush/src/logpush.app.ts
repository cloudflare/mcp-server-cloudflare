import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerLogsTools } from './tools/logpush.tools'

import type { Env } from './logpush.context'

/** Points users of this deprecated server to the Cloudflare API MCP server. */
export const DEPRECATION_INSTRUCTIONS = `DEPRECATED: This Logpush MCP server is deprecated. Use the Cloudflare API MCP server at https://mcp.cloudflare.com/mcp instead. It covers the full Cloudflare API, including Logpush.`

const LogPushScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'logpush:write':
		'Grants read and write access to Logpull and Logpush, and read access to Instant Logs. Note that all Logpush API operations require Logs: Write permission because Logpush jobs contain sensitive information.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serverId: 'logpush',
	serviceHostnames: ['logs-staging.mcp.cloudflare.com', 'logs.mcp.cloudflare.com'],
	scopes: LogPushScopes,
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	register: registerLogsTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
