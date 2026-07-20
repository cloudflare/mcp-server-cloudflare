import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerObservabilityTools } from './tools/workers-observability.tools'

import type { Env } from './workers-observability.context'

const ObservabilityScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:read':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_observability:read': 'See observability logs for your account',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'observability-staging.mcp.cloudflare.com',
	'observability.mcp.cloudflare.com',
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
	serverOptions: {
		instructions: `# Cloudflare Workers Observability Tool
* A Cloudflare Worker is a serverless function
* Workers Observability lets you inspect structured logs for your Cloudflare Workers

This server allows you to analyze your Cloudflare Workers logs and metrics.`,
	},
	createSentry: ({ env, executionCtx, request, props }) =>
		props?.type === 'user_token'
			? initSentryWithUser(env, executionCtx, props.user.id, request)
			: undefined,
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerWorkersTools(context)
		registerObservabilityTools(context)
		registerDocsTools(context)
		registerPrompts(context)
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
			scopes: ObservabilityScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
