import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

export type Env = {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	AUTORAG_NAME: 'cloudflare-docs-autorag'
	MCP_SERVER_NAME: 'PLACEHOLDER'
	MCP_SERVER_VERSION: 'PLACEHOLDER'
	MCP_METRICS: AnalyticsEngineDataset
	ASSETS: Fetcher
}

const allowedHostnames = ['localhost', '127.0.0.1', '[::1]', 'demo-day.mcp.cloudflare.com']

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		context.server.registerTool(
			'mcp_demo_day_info',
			{
				description:
					"Get information about Cloudflare's MCP Demo Day. Use this tool if the user asks about Cloudflare's MCP demo day",
			},
			async () => {
				const res = await context.env.ASSETS.fetch('https://assets.local/index.html')
				return {
					content: [
						{
							type: 'resource',
							resource: {
								uri: 'https://demo-day.mcp.cloudflare.com',
								mimeType: 'text/html',
								text: await res.text(),
							},
						},
						{
							type: 'text',
							text: "Above is the contents of the demo day webpage, hosted at https://demo-day.mcp.cloudflare.com. Use it to answer the user's questions.",
						},
					],
				}
			}
		)
	},
	handler: {
		allowedHostnames,
		allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
	},
})

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const pathname = new URL(request.url).pathname
		if (pathname === '/mcp') return mcpHandler.fetch(request, env, ctx)
		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
