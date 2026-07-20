import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './docs-autorag.app'

import type { Env } from './docs-autorag.context'

testStatelessMcpApp<Env>({
	name: 'Docs AutoRAG',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://docs-autorag.mcp.cloudflare.com',
	authenticatedWorker: worker,
	expectedTools: ['search_cloudflare_documentation'],
})
