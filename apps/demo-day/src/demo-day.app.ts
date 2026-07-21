import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'

export type Env = {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	AUTORAG_NAME: 'cloudflare-docs-autorag'
	MCP_SERVER_NAME: 'PLACEHOLDER'
	MCP_SERVER_VERSION: 'PLACEHOLDER'
	MCP_METRICS: AnalyticsEngineDataset
	ASSETS: Fetcher
}

const app = createPublicMcpApp<Env>({
	serviceHostnames: ['demo-day.mcp.cloudflare.com'],
	register(context) {
		context.registerTool(
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
})

export const mcpHandler = app.mcpHandler

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const pathname = new URL(request.url).pathname
		if (pathname === '/mcp') return mcpHandler.fetch(request, env, ctx)
		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
