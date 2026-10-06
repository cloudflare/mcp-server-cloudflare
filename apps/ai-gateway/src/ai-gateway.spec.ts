import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { DEPRECATION_INSTRUCTIONS, mcpHandler } from './ai-gateway.app'

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

function initializeRequest() {
	return new Request('https://ai-gateway.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: 'ai-gateway.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'ai-gateway-initialize',
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'ai-gateway-test', version: '1.0.0' },
			},
		}),
	})
}

async function responseDocument(response: Response): Promise<unknown> {
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
			accessToken: 'ai-gateway-token',
			account: { id: 'account-1', name: 'AI Gateway account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

describe('AI Gateway server deprecation', () => {
	it('advertises the Cloudflare API MCP server in its initialize instructions', async () => {
		const response = await mcpHandler.fetch(
			initializeRequest(),
			env as unknown as Env,
			deprecationContext()
		)

		expect(response.status).toBe(200)
		expect(await responseDocument(response)).toMatchObject({
			result: { instructions: DEPRECATION_INSTRUCTIONS },
		})
	})
})
