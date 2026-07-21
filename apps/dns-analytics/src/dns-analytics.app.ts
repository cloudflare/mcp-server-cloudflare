import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { registerZoneTools } from '@repo/mcp-common/src/tools/zone.tools'

import { registerAnalyticTools } from './tools/dex-analytics.tools'

import type { Env } from './dns-analytics.context'

const AnalyticsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'zone:read': 'See your zones',
	'dns_settings:read': 'See your DNS settings',
	'dns_analytics:read': 'See your DNS analytics',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: [
		'dns-analytics-staging.mcp.cloudflare.com',
		'dns-analytics.mcp.cloudflare.com',
	],
	scopes: AnalyticsScopes,
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	register(context) {
		registerAnalyticTools(context)
		registerZoneTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
