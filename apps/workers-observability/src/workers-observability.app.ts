import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'

import { registerObservabilityTools } from './tools/workers-observability.tools'

import type { Env } from './workers-observability.context'

const ObservabilityScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:read':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_observability:read': 'See observability logs for your account',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: [
		'observability-staging.mcp.cloudflare.com',
		'observability.mcp.cloudflare.com',
	],
	scopes: ObservabilityScopes,
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
	register(context) {
		registerWorkersTools(context)
		registerObservabilityTools(context)
		registerDocsTools(context)
		registerPrompts(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
