import { describe, expect, it } from 'vitest'

import type { AuthProps } from '../auth-props'
import type { CloudflareMcpHandler } from '../server'

const TEST_PROPS: AuthProps = {
	type: 'account_token',
	accessToken: 'test-token',
	account: { id: 'account-1', name: 'Test account' },
}

interface RequestHandler<Env> {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}

interface StatelessAppTestOptions<Env> {
	name: string
	handler: CloudflareMcpHandler<Env>
	env: Env
	url: string
	authenticated?: boolean
	authenticatedWorker?: RequestHandler<Env>
	browserOrigin?: string
	expectedTools?: string[]
	expectedPrompts?: string[]
	absentTools?: string[]
	requiredToolInputs?: Record<string, string[]>
}

/** Shared transport-contract checks for stateless application entry points. */
export function testStatelessMcpApp<Env>({
	name,
	handler,
	env,
	url,
	authenticated = false,
	authenticatedWorker,
	browserOrigin = 'https://playground.ai.cloudflare.com',
	expectedTools = [],
	expectedPrompts = [],
	absentTools = [],
	requiredToolInputs = {},
}: StatelessAppTestOptions<Env>) {
	const endpoint = new URL('/mcp', url).href
	const context = (withAuth = authenticated) =>
		({
			...(withAuth && { props: TEST_PROPS }),
			waitUntil() {},
			passThroughOnException() {},
		}) as ExecutionContext

	describe(`${name} stateless MCP transport`, () => {
		if (authenticated) {
			it('requires authentication at the exported Worker route', async () => {
				if (!authenticatedWorker) {
					throw new Error('authenticatedWorker is required for authenticated app tests')
				}
				const response = await authenticatedWorker.fetch(
					modernRequest(endpoint, 'server/discover'),
					env,
					context(false)
				)

				expect(response.status).toBe(401)
				expect(response.headers.get('www-authenticate')).toContain('resource_metadata')
			})
		}

		it('serves modern requests without creating protocol session state', async () => {
			const response = await handler.fetch(
				modernRequest(endpoint, 'server/discover'),
				env,
				context()
			)

			expect(response.status).toBe(200)
			expect(response.headers.get('mcp-session-id')).toBeNull()
			expect(await responseDocument(response)).toMatchObject({
				result: { supportedVersions: ['2026-07-28'] },
			})
		})

		it('registers the application tools on the fresh modern server', async () => {
			const response = await handler.fetch(modernRequest(endpoint, 'tools/list'), env, context())
			const document = await responseDocument(response)
			const tools = document.result.tools as Array<{
				name: string
				inputSchema?: { required?: string[] }
			}>
			const byName = new Map(tools.map((tool) => [tool.name, tool]))

			expect(response.status).toBe(200)
			expect(response.headers.get('mcp-session-id')).toBeNull()
			expect(tools.length).toBeGreaterThan(0)
			for (const name of expectedTools)
				expect(byName.has(name), `${name} should be registered`).toBe(true)
			for (const name of absentTools)
				expect(byName.has(name), `${name} should be absent`).toBe(false)
			for (const [name, required] of Object.entries(requiredToolInputs)) {
				expect(byName.get(name)?.inputSchema?.required).toEqual(expect.arrayContaining(required))
			}
		})

		if (expectedPrompts.length > 0) {
			it('registers the application prompts on the fresh modern server', async () => {
				const response = await handler.fetch(
					modernRequest(endpoint, 'prompts/list'),
					env,
					context()
				)
				const document = await responseDocument(response)
				const names = (document.result.prompts as Array<{ name: string }>).map(
					(prompt) => prompt.name
				)

				expect(response.status).toBe(200)
				for (const name of expectedPrompts)
					expect(names, `${name} should be registered`).toContain(name)
			})
		}

		it('keeps the default stateless 2025 fallback', async () => {
			const response = await handler.fetch(legacyInitializeRequest(endpoint), env, context())

			expect(response.status).toBe(200)
			expect(response.headers.get('mcp-session-id')).toBeNull()
			expect(await responseDocument(response)).toMatchObject({
				result: { protocolVersion: '2025-11-25' },
			})
		})

		it('allows the configured browser Origin and account-selection header', async () => {
			const policyHandler = authenticatedWorker ?? handler
			const response = await policyHandler.fetch(
				new Request(endpoint, {
					method: 'OPTIONS',
					headers: {
						Host: new URL(url).hostname,
						Origin: browserOrigin,
						'Access-Control-Request-Headers':
							'Authorization, cf-account-id, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
					},
				}),
				env,
				context()
			)

			expect([200, 204]).toContain(response.status)
			expect(response.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain(
				'cf-account-id'
			)
		})

		it('rejects unconfigured Host and Origin values at the HTTP boundary', async () => {
			const policyHandler = authenticatedWorker ?? handler
			const badHost = modernRequest(endpoint, 'server/discover')
			badHost.headers.set('Host', 'evil.example.com')
			expect((await policyHandler.fetch(badHost, env, context(false))).status).toBe(403)

			const badOrigin = modernRequest(endpoint, 'server/discover')
			badOrigin.headers.set('Origin', 'https://evil.example.com')
			expect((await policyHandler.fetch(badOrigin, env, context(false))).status).toBe(403)
		})

		it('exposes neither a compatibility SSE route nor an MCP Durable Object binding', async () => {
			const routeHandler = authenticatedWorker ?? handler
			const response = await routeHandler.fetch(
				new Request(new URL('/sse', url), {
					method: 'GET',
					headers: { Host: new URL(url).hostname },
				}),
				env,
				context(false)
			)

			expect(response.status).toBe(404)
			expect('MCP_OBJECT' in (env as object)).toBe(false)
		})
	})
}

function modernRequest(url: string, method: string) {
	return new Request(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': method,
			Host: new URL(url).hostname,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: crypto.randomUUID(),
			method,
			params: {
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': {
						name: 'application-migration-test',
						version: '1.0.0',
					},
					'io.modelcontextprotocol/clientCapabilities': {},
				},
			},
		}),
	})
}

function legacyInitializeRequest(url: string) {
	return new Request(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Host: new URL(url).hostname,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: crypto.randomUUID(),
			method: 'initialize',
			params: {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'application-migration-test', version: '1.0.0' },
			},
		}),
	})
}

async function responseDocument(response: Response): Promise<Record<string, any>> {
	const text = await response.text()
	if (response.headers.get('content-type')?.includes('application/json')) {
		return JSON.parse(text)
	}
	const data = text
		.split('\n')
		.find((line) => line.startsWith('data: '))
		?.slice('data: '.length)
	if (!data) throw new Error(`Expected an MCP response document, received: ${text}`)
	return JSON.parse(data)
}
