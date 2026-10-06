import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { DEPRECATION_INSTRUCTIONS, mcpHandler } from './workers-observability.app'

import type { Env } from './workers-observability.context'

testStatelessMcpApp<Env>({
	name: 'Workers Observability',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://observability.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['query_worker_observability', 'observability_keys', 'observability_values'],
	expectedPrompts: ['workers-prompt-full'],
})

function initializeRequest() {
	return new Request('https://observability.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: 'observability.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'workers-observability-initialize',
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'workers-observability-test', version: '1.0.0' },
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
			accessToken: 'workers-observability-token',
			account: { id: 'account-1', name: 'Workers Observability account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

describe('Workers Observability server deprecation', () => {
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
