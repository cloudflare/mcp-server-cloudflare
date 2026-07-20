import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './radar.app'

import type { Env } from './radar.context'

testStatelessMcpApp<Env>({
	name: 'Radar',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://radar.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['list_autonomous_systems', 'search_url_scans'],
})
