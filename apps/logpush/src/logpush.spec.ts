import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './logpush.app'

import type { Env } from './logpush.context'

testStatelessMcpApp<Env>({
	name: 'Logpush',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://logs.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['logpush_jobs_by_account_id'],
})
