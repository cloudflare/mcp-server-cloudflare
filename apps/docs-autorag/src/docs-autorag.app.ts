import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerDocsTools } from './tools/docs-autorag.tools'

import type { Env } from './docs-autorag.context'

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'docs-autorag-staging.mcp.cloudflare.com',
	'docs-autorag.mcp.cloudflare.com',
]

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register: registerDocsTools,
	handler: {
		allowedHostnames,
		allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
	},
})

export default mcpHandler
