import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerZoneTools } from '@repo/mcp-common/src/tools/zone.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerGraphQLTools } from './tools/graphql.tools'

import type { Env } from './graphql.context'

const GraphQLScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'zone:read': 'See zone data such as settings, analytics, and DNS records.',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'graphql-staging.mcp.cloudflare.com',
	'graphql.mcp.cloudflare.com',
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
	createSentry: ({ env, executionCtx, request, props }) =>
		props?.type === 'user_token'
			? initSentryWithUser(env, executionCtx, props.user.id, request)
			: undefined,
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerZoneTools(context)
		registerGraphQLTools(context)
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
			scopes: GraphQLScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
