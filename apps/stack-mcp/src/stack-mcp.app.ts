import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'

import { registerStackTools } from './tools/stack.tools'
import { STACK_LIBRARIES, toPublicLibrary } from './types/stack.types'

import type { Env } from './stack-mcp.context'

const app = createPublicMcpApp<Env>({
	serviceHostnames: ['stack-staging.mcp.cloudflare.com', 'stack.mcp.cloudflare.com'],
	register: registerStackTools,
})

export const mcpHandler = app.mcpHandler

export default {
	fetch(req: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(req.url)
		if (url.pathname === '/libraries') {
			// Public catalog for UI pickers (e.g. the Workers AI Playground). Fetched
			// cross-origin from the browser, so it needs permissive CORS.
			return Response.json(
				{ libraries: STACK_LIBRARIES.map(toPublicLibrary) },
				{ headers: { 'access-control-allow-origin': '*' } }
			)
		}
		return app.worker.fetch(req, env, ctx)
	},
}
