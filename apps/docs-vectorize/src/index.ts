import { McpAgent } from 'agents/mcp'

import { getEnv } from '@repo/mcp-common/src/env'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

import { registerDocsTools } from './tools/docs'

import type { Env } from './context'

const env = getEnv<Env>()

// The docs MCP server isn't stateful, so we don't have state/props
export type Props = never

export type State = never

export class CloudflareDocumentationMCP extends McpAgent<Env, State, Props> {
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
		registerDocsTools(this)
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)

		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			// @ts-ignore
			return CloudflareDocumentationMCP.serveSSE('/sse').fetch(request, env, ctx)
		}

		if (url.pathname === '/mcp') {
			// @ts-ignore
			return CloudflareDocumentationMCP.serve('/mcp').fetch(request, env, ctx)
		}

		return new Response('Not found', { status: 404 })
	},
}
