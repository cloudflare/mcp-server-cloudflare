import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './graphql.app'

import type { Env } from './graphql.context'

testStatelessMcpApp<Env>({
	name: 'GraphQL',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://graphql.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['graphql_schema_search', 'graphql_query', 'zones_list'],
})

function context(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'graphql-token',
			account: { id: 'account-1', name: 'GraphQL account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

function toolCall(name: string, arguments_: Record<string, unknown>) {
	return new Request('https://graphql.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/call',
			'Mcp-Name': name,
			Host: 'graphql.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'graphql-call',
			method: 'tools/call',
			params: {
				name,
				arguments: arguments_,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'graphql-test', version: '1.0.0' },
					'io.modelcontextprotocol/clientCapabilities': {},
				},
			},
		}),
	})
}

async function responseDocument(response: Response): Promise<Record<string, any>> {
	const text = await response.text()
	if (response.headers.get('content-type')?.includes('application/json')) return JSON.parse(text)
	const data = text
		.split('\n')
		.find((line) => line.startsWith('data: '))
		?.slice('data: '.length)
	if (!data) throw new Error(`Expected an MCP response document, received: ${text}`)
	return JSON.parse(data)
}

function mockGraphQLResponse(body: unknown) {
	const fetchMock = vi.fn(async () => Response.json(body))
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('GraphQL API response handling', () => {
	it.each([
		{
			name: 'a nullable path',
			message: 'not authorized for that account',
			body: {
				data: null,
				errors: [
					{
						message: 'not authorized for that account',
						path: null,
						extensions: {
							code: 'authz',
							timestamp: '2026-06-19T00:00:00Z',
							ray_id: 'test-ray',
						},
					},
				],
			},
		},
		{
			name: 'no path or extensions',
			message: 'Mutations are not supported',
			body: {
				data: null,
				errors: [{ message: 'Mutations are not supported' }],
			},
		},
		{
			name: 'locations but no path',
			message: 'Cannot query field "missing"',
			body: {
				errors: [
					{
						message: 'Cannot query field "missing"',
						locations: [{ line: 1, column: 9 }],
					},
				],
			},
		},
	])('returns an API error with $name instead of a Zod error', async ({ body, message }) => {
		mockGraphQLResponse(body)
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		const response = await mcpHandler.fetch(
			toolCall('graphql_query', { query: 'query { missing }' }),
			env as unknown as Env,
			context()
		)
		const document = await responseDocument(response)
		const text = document.result.content[0].text as string

		expect(response.status).toBe(200)
		expect(document.result.isError).not.toBe(true)
		expect(JSON.parse(text.split('\n\n')[0]).errors[0].message).toBe(message)
		expect(text).not.toContain('invalid_union')
	})

	it('accepts a successful response that omits errors', async () => {
		mockGraphQLResponse({ data: { viewer: { zones: [] } } })

		const response = await mcpHandler.fetch(
			toolCall('graphql_query', { query: 'query { viewer { zones { zoneTag } } }' }),
			env as unknown as Env,
			context()
		)
		const document = await responseDocument(response)

		expect(document.result.isError).not.toBe(true)
		expect(document.result.content[0].text).toContain('"viewer":{"zones":[]}')
	})

	it('passes through an unrecognized response shape instead of throwing', async () => {
		mockGraphQLResponse({
			data: null,
			errors: [{ message: 'upstream-specific error', extensions: ['custom', 'shape'] }],
		})
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		const response = await mcpHandler.fetch(
			toolCall('graphql_query', { query: 'query { viewer { zones { zoneTag } } }' }),
			env as unknown as Env,
			context()
		)
		const document = await responseDocument(response)
		const text = document.result.content[0].text as string

		expect(document.result.isError).not.toBe(true)
		expect(text).toContain('upstream-specific error')
		expect(text).toContain('"extensions":["custom","shape"]')
	})

	it('surfaces path-less API errors from schema requests', async () => {
		mockGraphQLResponse({
			data: null,
			errors: [{ message: 'not authorized to inspect the schema', path: null }],
		})
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		const response = await mcpHandler.fetch(
			toolCall('graphql_schema_overview', {}),
			env as unknown as Env,
			context()
		)
		const document = await responseDocument(response)
		const text = document.result.content[0].text as string

		expect(document.result.isError).toBe(true)
		expect(text).toContain('not authorized to inspect the schema')
		expect(text).not.toContain('invalid_union')
	})
})
