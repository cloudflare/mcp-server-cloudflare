import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import type { Env } from './docs-ai-search.context'

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'docs-staging.mcp.cloudflare.com',
	'docs.mcp.cloudflare.com',
]

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerDocsTools(context)
		registerPrompts(context)
	},
	handler: {
		allowedHostnames,
		allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
	},
})

export default mcpHandler
