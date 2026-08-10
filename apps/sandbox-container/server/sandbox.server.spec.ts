import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './sandbox.server.app'

import type { Env } from './sandbox.server.context'

testStatelessMcpApp<Env>({
	name: 'Sandbox Container',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://containers.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['container_initialize', 'container_exec', 'container_file_read'],
})

describe('sandbox application state boundary', () => {
	it('preserves container lifecycle state but no MCP protocol Durable Object', () => {
		expect('USER_CONTAINER' in env).toBe(true)
		expect('CONTAINER_MANAGER' in env).toBe(true)
		expect('MCP_OBJECT' in env).toBe(false)
	})
})
