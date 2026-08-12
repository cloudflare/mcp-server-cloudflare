import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './cf1-casb.app'

import type { Env } from './cf1-casb.context'

testStatelessMcpApp<Env>({
	name: 'Cloudflare One CASB',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://casb.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: [
		'integration_by_id',
		'integrations_list',
		'assets_search',
		'asset_by_id',
		'assets_by_integration_id',
		'assets_by_category_id',
		'assets_list',
		'asset_categories_list',
		'asset_categories_by_vendor',
		'asset_categories_by_type',
		'asset_categories_by_vendor_and_type',
	],
})
