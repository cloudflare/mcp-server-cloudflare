import { createMcpHandler, McpAgent } from 'agents/mcp'

import { getEnv } from '@repo/mcp-common/src/env'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

import { registerBlogTools } from './tools/blog.tools'

import type { Env } from './cloudflare-blog.context'

const env = getEnv<Env>()

export class CloudflareBlogMCP extends McpAgent<Env, never, never> {
	_server: CloudflareMCPServer | undefined
	set server(server: CloudflareMCPServer) {
		this._server = server
	}
	get server(): CloudflareMCPServer {
		if (!this._server) {
			throw new Error('Tried to access server before it was initialized')
		}
		return this._server
	}

	constructor(
		ctx: DurableObjectState,
		public env: Env
	) {
		super(ctx, env)
	}

	async init() {
		this.server = createMcpServer(env, this.ctx)
	}
}

const sseHandler = CloudflareBlogMCP.serveSSE('/sse')

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		const url = new URL(req.url)
		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			return sseHandler.fetch(req, env, ctx)
		}
		if (url.pathname === '/mcp') {
			const server = createMcpServer(env, ctx, req)
			const mcpHandler = createMcpHandler(server)
			return mcpHandler(req, env, ctx)
		}
		return new Response('Not found', { status: 404 })
	},
}

function createMcpServer(
	env: Env,
	_ctx: {
		waitUntil: ExecutionContext['waitUntil']
	},
	_req?: Request
) {
	const server = new CloudflareMCPServer({
		wae: env.MCP_METRICS,
		serverInfo: {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		},
	})

	registerBlogTools(server, env)

	return server
}
