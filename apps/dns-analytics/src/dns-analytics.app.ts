import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { registerZoneTools } from '@repo/mcp-common/src/shared-tools/zone.tools'

import { registerAnalyticTools } from './tools/dex-analytics.tools'

import type { Env } from './dns-analytics.context'

/** Points users of this deprecated server to the Cloudflare API MCP server. */
export const DEPRECATION_INSTRUCTIONS = `DEPRECATED: This DNS Analytics MCP server is deprecated. Use the Cloudflare API MCP server at https://mcp.cloudflare.com/mcp instead. It covers the full Cloudflare API, including DNS Analytics.`

const AnalyticsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'zone:read': 'See your zones',
	'dns_settings:read': 'See your DNS settings',
	'dns_analytics:read': 'See your DNS analytics',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serverId: 'dns-analytics',
	serviceHostnames: [
		'dns-analytics-staging.mcp.cloudflare.com',
		'dns-analytics.mcp.cloudflare.com',
	],
	scopes: AnalyticsScopes,
	serverOptions: { instructions: DEPRECATION_INSTRUCTIONS },
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	register(context) {
		registerAnalyticTools(context)
		registerZoneTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
