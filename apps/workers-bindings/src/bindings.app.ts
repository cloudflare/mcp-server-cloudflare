import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { registerD1Tools } from '@repo/mcp-common/src/tools/d1.tools'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'
import { registerHyperdriveTools } from '@repo/mcp-common/src/tools/hyperdrive.tools'
import { registerKVTools } from '@repo/mcp-common/src/tools/kv_namespace.tools'
import { registerR2BucketTools } from '@repo/mcp-common/src/tools/r2_bucket.tools'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'

import type { Env } from './bindings.context'

const BindingsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'd1:write': 'Create, read, and write to D1 databases',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['bindings-staging.mcp.cloudflare.com', 'bindings.mcp.cloudflare.com'],
	scopes: BindingsScopes,
	register(context) {
		registerKVTools(context)
		registerWorkersTools(context)
		registerR2BucketTools(context)
		registerD1Tools(context)
		registerHyperdriveTools(context)
		registerDocsTools(context)
		registerPrompts(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
