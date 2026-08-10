import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './bindings.app'

import type { Env } from './bindings.context'

testStatelessMcpApp<Env>({
	name: 'Workers Bindings',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://bindings.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['workers_list', 'kv_namespaces_list', 'd1_databases_list'],
	expectedPrompts: ['workers-prompt-full'],
})
