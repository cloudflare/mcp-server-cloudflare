import { McpAgent } from 'agents/mcp'

import { getEnv } from '@repo/mcp-common/src/env'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

// The demo day MCP server isn't stateful, so we don't have state/props
export type Props = never

export type State = never

export type Env = {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	AUTORAG_NAME: 'cloudflare-docs-autorag'
	MCP_SERVER_NAME: 'PLACEHOLDER'
	MCP_SERVER_VERSION: 'PLACEHOLDER'
	MCP_OBJECT: DurableObjectNamespace<CloudflareDemoDayMCP>
	MCP_METRICS: AnalyticsEngineDataset
	ASSETS: Fetcher
}

const env = getEnv<Env>()

export class CloudflareDemoDayMCP extends McpAgent<Env, State, Props> {
	server = new CloudflareMCPServer({
		wae: env.MCP_METRICS,
		serverInfo: {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		},
	})

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		super(ctx, env)
	}

	async init() {
		this.server.tool(
			'mcp_demo_day_info',
			"Get information about Cloudflare's MCP Demo Day. Use this tool if the user asks about Cloudflare's MCP demo day",
			async () => {
				const res = await this.env.ASSETS.fetch('https://assets.local/index.html')
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
	}
}

export default CloudflareDemoDayMCP.mount('/sse')
