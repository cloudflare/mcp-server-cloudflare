import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './ai-gateway.app'

import type { Env } from './ai-gateway.context'

testStatelessMcpApp<Env>({
	name: 'AI Gateway',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://ai-gateway.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: [
		'list_gateways',
		'list_logs',
		'get_log_details',
		'get_log_request_body',
		'get_log_response_body',
	],
})
