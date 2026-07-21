import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './auditlogs.app'

import type { Env } from './auditlogs.context'

testStatelessMcpApp<Env>({
	name: 'Audit Logs',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://auditlogs.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['auditlogs_by_account_id'],
})
