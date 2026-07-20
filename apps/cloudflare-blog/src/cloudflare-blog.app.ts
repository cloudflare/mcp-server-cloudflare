import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerBlogTools } from './tools/blog.tools'

import type { Env } from './cloudflare-blog.context'

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'blog-staging.mcp.cloudflare.com',
	'blog.mcp.cloudflare.com',
]

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register: registerBlogTools,
	handler: {
		allowedHostnames,
		allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
	},
})

export default mcpHandler
