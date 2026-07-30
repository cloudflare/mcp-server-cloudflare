import { createMcpHandler, McpAgent } from 'agents/mcp'

import { getEnv } from '@repo/mcp-common/src/env'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

import { registerStackTools } from './tools/stack.tools'
import { resolveLibraries, STACK_LIBRARIES, toPublicLibrary } from './types/stack.types'

import type { Env } from './stack-mcp.context'

const env = getEnv<Env>()

export class CloudflareDevStackMCP extends McpAgent<Env, never, never> {
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
		// SSE transport (per-session DO) serves the whole stack.
		this.server = createMcpServer(env, this.ctx)
	}
}

const sseHandler = CloudflareDevStackMCP.serveSSE('/sse')

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		const url = new URL(req.url)
		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			return sseHandler.fetch(req, env, ctx)
		}
		if (url.pathname === '/mcp') {
			// Streamable HTTP: scope the stack per-request via `?libs=slug,slug`.
			const server = createMcpServer(env, ctx, req)
			const mcpHandler = createMcpHandler(server)
			return mcpHandler(req, env, ctx)
		}
		if (url.pathname === '/libraries') {
			// Public catalog for UI pickers (e.g. the Workers AI Playground). Fetched
			// cross-origin from the browser, so it needs permissive CORS.
			return Response.json(
				{ libraries: STACK_LIBRARIES.map(toPublicLibrary) },
				{ headers: { 'access-control-allow-origin': '*' } }
			)
		}
		return new Response('Not found', { status: 404 })
	},
}

function createMcpServer(
	env: Env,
	_ctx: { waitUntil: ExecutionContext['waitUntil'] },
	req?: Request
) {
	const server = new CloudflareMCPServer({
		wae: env.MCP_METRICS,
		serverInfo: {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		},
	})

	const libsParam = req ? new URL(req.url).searchParams.get('libs') : null
	const allowed = resolveLibraries(libsParam)

	registerStackTools(server, env, allowed)

	return server
}
