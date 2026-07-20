import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerBrowserTools } from './tools/browser.tools'

import type { Env } from './browser.context'

const BrowserScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'browser:write': 'Grants write level access to Browser Run.',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'browser-staging.mcp.cloudflare.com',
	'browser.mcp.cloudflare.com',
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
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register: registerBrowserTools,
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
			scopes: BrowserScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
