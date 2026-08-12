import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerLogsTools } from './tools/logpush.tools'

import type { Env } from './logpush.context'

const LogPushScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'logpush:write':
		'Grants read and write access to Logpull and Logpush, and read access to Instant Logs. Note that all Logpush API operations require Logs: Write permission because Logpush jobs contain sensitive information.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['logs-staging.mcp.cloudflare.com', 'logs.mcp.cloudflare.com'],
	scopes: LogPushScopes,
	register: registerLogsTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
