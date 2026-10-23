import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { DEPRECATION_INSTRUCTIONS, mcpHandler } from './dns-analytics.app'

import type { Env } from './dns-analytics.context'

testStatelessMcpApp<Env>({
	name: 'DNS Analytics',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://dns-analytics.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['dns_report', 'show_account_dns_settings', 'show_zone_dns_settings'],
	requiredToolInputs: {
		dns_report: ['zoneId', 'days'],
		show_zone_dns_settings: ['zoneId'],
	},
})

function initializeRequest() {
	return new Request('https://dns-analytics.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: 'dns-analytics.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'dns-analytics-initialize',
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'dns-analytics-test', version: '1.0.0' },
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
			accessToken: 'dns-analytics-token',
			account: { id: 'account-1', name: 'DNS Analytics account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

describe('DNS Analytics server deprecation', () => {
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
