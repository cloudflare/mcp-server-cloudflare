import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './dns-analytics.app'

import type { Env } from './dns-analytics.context'

testStatelessMcpApp<Env>({
	name: 'DNS Analytics',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://dns-analytics.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['dns_report', 'show_account_dns_settings', 'show_zone_dns_settings'],
})
