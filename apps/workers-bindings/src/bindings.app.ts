import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerD1Tools } from '@repo/mcp-common/src/tools/d1.tools'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'
import { registerHyperdriveTools } from '@repo/mcp-common/src/tools/hyperdrive.tools'
import { registerKVTools } from '@repo/mcp-common/src/tools/kv_namespace.tools'
import { registerR2BucketTools } from '@repo/mcp-common/src/tools/r2_bucket.tools'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import type { Env } from './bindings.context'

const BindingsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'd1:write': 'Create, read, and write to D1 databases',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'bindings-staging.mcp.cloudflare.com',
	'bindings.mcp.cloudflare.com',
]
const mcpRequestPolicy = {
	allowedHostnames,
	allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
}

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	requireAuth: true,
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerKVTools(context)
		registerWorkersTools(context)
		registerR2BucketTools(context)
		registerD1Tools(context)
		registerHyperdriveTools(context)
		registerDocsTools(context)
		registerPrompts(context)
	},
	handler: mcpRequestPolicy,
})

const apiHandler = createApiHandler(mcpHandler)

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const metrics = new MetricsTracker(env.MCP_METRICS, {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		})
		return createCloudflareOAuthRouter({
			apiHandler,
			scopes: BindingsScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
