import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import { mcpHandler } from './cloudflare-blog.app'

import type { Env } from './cloudflare-blog.context'

testStatelessMcpApp<Env>({
	name: 'Cloudflare Blog',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://blog.mcp.cloudflare.com',
	expectedTools: ['search_posts', 'list_posts', 'get_post', 'list_tags'],
})
