import { env } from 'cloudflare:test'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './browser.app'

import type { Env } from './browser.context'

testStatelessMcpApp<Env>({
	name: 'Browser Rendering',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://browser.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: [
		'get_url_html_content',
		'get_url_markdown',
		'get_url_screenshot',
		'get_url_pdf',
		'get_url_snapshot',
		'scrape_url_elements',
		'get_url_json',
		'get_url_links',
		'start_crawl',
		'get_crawl_result',
		'cancel_crawl',
		'list_browser_sessions',
		'kill_browser_session',
	],
})
