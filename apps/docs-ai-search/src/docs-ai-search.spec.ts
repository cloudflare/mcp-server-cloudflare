import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import { mcpHandler } from './docs-ai-search.app'

import type { Env } from './docs-ai-search.context'

testStatelessMcpApp<Env>({
	name: 'Documentation AI Search',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://docs.mcp.cloudflare.com',
	expectedTools: ['search_cloudflare_documentation', 'migrate_pages_to_workers_guide'],
	expectedPrompts: ['workers-prompt-full'],
})
