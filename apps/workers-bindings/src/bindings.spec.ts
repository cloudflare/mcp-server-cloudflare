import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { DEPRECATION_INSTRUCTIONS, mcpHandler } from './bindings.app'

import type { Env } from './bindings.context'

testStatelessMcpApp<Env>({
	name: 'Workers Bindings',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://bindings.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['workers_list', 'kv_namespaces_list', 'd1_databases_list'],
	expectedPrompts: ['workers-prompt-full'],
})

function initializeRequest() {
	return new Request('https://bindings.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: 'bindings.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'workers-bindings-initialize',
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'workers-bindings-test', version: '1.0.0' },
			},
		}),
	})
}

async function responseDocument(
	response: Response
): Promise<{ result?: { instructions?: string } }> {
	const text = await response.text()
	if (response.headers.get('content-type')?.includes('application/json')) return JSON.parse(text)
	const data = text
		.split('\n')
		.find((line) => line.startsWith('data: '))
		?.slice('data: '.length)
	if (!data) throw new Error(`Expected an MCP response document, received: ${text}`)
	return JSON.parse(data)
}

function deprecationContext(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'workers-bindings-token',
			account: { id: 'account-1', name: 'Workers Bindings account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

describe('Workers Bindings server deprecation', () => {
	it('leads its initialize instructions with the Cloudflare API MCP server', async () => {
		const response = await mcpHandler.fetch(
			initializeRequest(),
			env as unknown as Env,
			deprecationContext()
		)

		expect(response.status).toBe(200)
		const document = await responseDocument(response)
		expect(document.result?.instructions?.startsWith(DEPRECATION_INSTRUCTIONS)).toBe(true)
	})
})
