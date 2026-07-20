import type { RequestHandler } from './api-token-mode'

/**
 * Restricts an exported stateless handler to its exact Streamable HTTP route.
 * No compatibility transport route is provided.
 */
export function createApiHandler<Env>(
	handler: RequestHandler<Env>,
	options: { route?: string } = {}
): RequestHandler<Env> {
	const route = options.route ?? '/mcp'
	return {
		fetch(req, env, ctx) {
			if (new URL(req.url).pathname !== route) {
				return new Response('Not found', { status: 404 })
			}
			return handler.fetch(req, env, ctx)
		},
	}
}
