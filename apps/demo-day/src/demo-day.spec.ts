import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './demo-day.app'

import type { Env } from './demo-day.app'

testStatelessMcpApp<Env>({
	name: 'Demo Day',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://demo-day.mcp.cloudflare.com',
	authenticatedWorker: worker,
	expectedTools: ['mcp_demo_day_info'],
})
