import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './dex-analysis.app'

import type { Env } from './dex-analysis.context'

testStatelessMcpApp<Env>({
	name: 'DEX Analysis',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://dex.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['dex_list_tests', 'dex_list_remote_warp_diag_contents'],
})

describe('DEX application state boundary', () => {
	it('preserves only the WARP diagnostic cache Durable Object', () => {
		expect('WARP_DIAG_READER' in env).toBe(true)
		expect('MCP_OBJECT' in env).toBe(false)
	})
})
