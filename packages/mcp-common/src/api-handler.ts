import type { McpAgent } from 'agents/mcp'

// Support both SSE and Streamable HTTP
export function createApiHandler<
	T extends typeof McpAgent<unknown, unknown, Record<string, unknown>>,
>(agent: T, opts?: { binding?: string }) {
	return {
		fetch: (req: Request, env: unknown, ctx: ExecutionContext) => {
			const url = new URL(req.url)
			if (url.pathname === '/sse' || url.pathname === '/sse/message') {
				return agent.serveSSE('/sse', { binding: opts?.binding }).fetch(req, env, ctx)
			}
			if (url.pathname === '/mcp') {
				return agent.serve('/mcp', { binding: opts?.binding }).fetch(req, env, ctx)
			}
			return new Response('Not found', { status: 404 })
		},
	}
}
