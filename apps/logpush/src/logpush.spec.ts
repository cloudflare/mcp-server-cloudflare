import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { DEPRECATION_INSTRUCTIONS, mcpHandler } from './logpush.app'

import type { Env } from './logpush.context'

testStatelessMcpApp<Env>({
	name: 'Logpush',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://logs.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['logpush_jobs_by_account_id'],
})

function initializeRequest() {
	return new Request('https://logs.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: 'logs.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'logpush-initialize',
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'logpush-test', version: '1.0.0' },
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

function context(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'logpush-token',
			account: { id: 'account-1', name: 'Logpush account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

describe('Logpush server deprecation', () => {
	it('advertises the Cloudflare API MCP server in its initialize instructions', async () => {
		const response = await mcpHandler.fetch(initializeRequest(), env as unknown as Env, context())

		expect(response.status).toBe(200)
		expect(await responseDocument(response)).toMatchObject({
			result: { instructions: DEPRECATION_INSTRUCTIONS },
		})
	})
})
