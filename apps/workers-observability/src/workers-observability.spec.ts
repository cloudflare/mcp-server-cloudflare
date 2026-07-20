import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './workers-observability.app'

import type { Env } from './workers-observability.context'

testStatelessMcpApp<Env>({
	name: 'Workers Observability',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://observability.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['query_worker_observability', 'observability_keys', 'observability_values'],
	expectedPrompts: ['workers-prompt-full'],
})
