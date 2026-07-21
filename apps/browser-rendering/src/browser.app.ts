import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerBrowserTools } from './tools/browser.tools'

import type { Env } from './browser.context'

const BrowserScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'browser:write': 'Grants write level access to Browser Run.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['browser-staging.mcp.cloudflare.com', 'browser.mcp.cloudflare.com'],
	scopes: BrowserScopes,
	register: registerBrowserTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
