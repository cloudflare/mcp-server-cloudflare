import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerZoneTools } from '@repo/mcp-common/src/tools/zone.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerAnalyticTools } from './tools/dex-analytics.tools'

import type { Env } from './dns-analytics.context'

const AnalyticsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'zone:read': 'See your zones',
	'dns_settings:read': 'See your DNS settings',
	'dns_analytics:read': 'See your DNS analytics',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'dns-analytics-staging.mcp.cloudflare.com',
	'dns-analytics.mcp.cloudflare.com',
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
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerAnalyticTools(context)
		registerZoneTools(context)
	},
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
			scopes: AnalyticsScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
