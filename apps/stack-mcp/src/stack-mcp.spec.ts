import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import { mcpHandler } from './stack-mcp.app'

import type { Env } from './stack-mcp.context'

testStatelessMcpApp<Env>({
	name: 'Cloudflare Developer Stack',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://stack.mcp.cloudflare.com',
	expectedTools: ['list_libraries', 'search_dev_stack'],
	requiredToolInputs: { search_dev_stack: ['query'] },
})
