import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import { mcpHandler } from './docs-vectorize.app'

import type { Env } from './docs-vectorize.context'

testStatelessMcpApp<Env>({
	name: 'Documentation Vectorize',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://docs-vectorize.mcp.cloudflare.com',
	expectedTools: ['search_cloudflare_documentation', 'migrate_pages_to_workers_guide'],
	expectedPrompts: ['workers-prompt-full'],
})
