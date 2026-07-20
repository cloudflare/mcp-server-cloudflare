import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './autorag.app'

import type { Env } from './autorag.context'

testStatelessMcpApp<Env>({
	name: 'AutoRAG',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://autorag.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['list_rags', 'search', 'ai_search'],
})
