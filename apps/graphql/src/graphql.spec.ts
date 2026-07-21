import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './graphql.app'

import type { Env } from './graphql.context'

testStatelessMcpApp<Env>({
	name: 'GraphQL',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://graphql.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['graphql_schema_search', 'graphql_query', 'zones_list'],
})
