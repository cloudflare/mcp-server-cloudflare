import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createCloudflareMcpHandler } from './server'

import type { AuthInfo, ServerContext } from '@modelcontextprotocol/server'
import type { MetricsEvent, MetricsTracker } from '@repo/mcp-observability'
import type { AuthProps } from './auth-props'
import type { McpRegistrationContext } from './registration-context'
import type { SentryClient } from './sentry'

const VERIFIED_OAUTH_CONTEXT = Symbol.for('cloudflare.workers-oauth-provider.verified-context.v1')

type TestEnv = { requestLabel: string }

const multiAccountProps: AuthProps = {
	type: 'user_token',
	accessToken: 'secret',
	user: { id: 'user-1', email: 'user@example.com' },
	accounts: [
		{ id: 'account-a', name: 'A' },
		{ id: 'account-b', name: 'B' },
	],
}

function executionContext(
	props: Record<string, unknown> = {},
	onWaitUntil?: (promise: Promise<unknown>) => void
): ExecutionContext {
	return {
		props,
		waitUntil: onWaitUntil ?? (() => undefined),
		passThroughOnException() {},
	} as ExecutionContext
}

function verifiedExecutionContext(props: AuthProps, auth: Omit<AuthInfo, 'extra'>) {
	const ctx = executionContext(props) as ExecutionContext & Record<symbol, unknown>
	Object.defineProperty(ctx, VERIFIED_OAUTH_CONTEXT, {
		value: {
			version: 1,
			token: auth.token,
			clientId: auth.clientId,
			scopes: auth.scopes,
			expiresAt: auth.expiresAt,
			resource: auth.resource?.href,
			props,
		},
	})
	return ctx
}

function modernRequest(
	method: string,
	params: Record<string, unknown> = {},
	headers: Record<string, string> = {}
) {
	const name = typeof params.name === 'string' ? params.name : undefined
	return new Request('https://mcp.example.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': method,
			...(name && { 'Mcp-Name': name }),
			...headers,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: crypto.randomUUID(),
			method,
			params: {
				...params,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': {
						name: 'foundation-test',
						version: '1.0.0',
					},
					'io.modelcontextprotocol/clientCapabilities': {},
				},
			},
		}),
	})
}

function legacyRequest(method: string, params: Record<string, unknown>) {
	return new Request('https://mcp.example.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
	})
}

function legacyInitializeRequest() {
	return legacyRequest('initialize', {
		protocolVersion: '2025-11-25',
		capabilities: {},
		clientInfo: { name: 'legacy-test', version: '1.0.0' },
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

function textResult(document: Record<string, any>): string {
	return document.result.content[0].text
}

describe('shared stateless MCP foundation', () => {
	it('refuses an override of the default stateless 2025 fallback', () => {
		expect(() =>
			createCloudflareMcpHandler<TestEnv>({
				serverInfo: { name: 'foundation', version: '1.0.0' },
				register() {},
				handler: { legacy: 'reject' } as never,
			})
		).toThrow('do not set legacy')
	})

	it('serves modern discovery and the default stateless 2025 fallback', async () => {
		const instances = new Set<object>()
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'foundation', version: '1.0.0' },
			register(context) {
				instances.add(context)
				let calls = 0
				context.registerTool('counter', { inputSchema: z.object({}) }, async () => ({
					content: [{ type: 'text', text: String(++calls) }],
				}))
			},
		})
		const env = { requestLabel: 'test' }

		const discover = await handler.fetch(modernRequest('server/discover'), env, executionContext())
		expect(discover.status).toBe(200)
		expect(await responseDocument(discover)).toMatchObject({
			result: {
				supportedVersions: ['2026-07-28'],
				serverInfo: { name: 'foundation', version: '1.0.0' },
			},
		})

		const initialize = await handler.fetch(legacyInitializeRequest(), env, executionContext())
		expect(initialize.status).toBe(200)
		expect(initialize.headers.get('mcp-session-id')).toBeNull()
		expect(await responseDocument(initialize)).toMatchObject({
			result: { protocolVersion: '2025-11-25' },
		})

		const first = await handler.fetch(
			legacyRequest('tools/call', { name: 'counter', arguments: {} }),
			env,
			executionContext()
		)
		const second = await handler.fetch(
			legacyRequest('tools/call', { name: 'counter', arguments: {} }),
			env,
			executionContext()
		)
		expect(textResult(await responseDocument(first))).toBe('1')
		expect(textResult(await responseDocument(second))).toBe('1')

		const noSessionStream = await handler.fetch(
			new Request('https://mcp.example.com/mcp', {
				method: 'GET',
				headers: { Accept: 'text/event-stream' },
			}),
			env,
			executionContext()
		)
		expect(noSessionStream.status).toBe(405)
		expect(noSessionStream.headers.get('mcp-session-id')).toBeNull()
		expect(instances.size).toBe(4)
	})

	it('rejects oversized MCP request bodies before constructing a server', async () => {
		let registrations = 0
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'body-limit', version: '1.0.0' },
			register() {
				registrations++
			},
		})
		const body = JSON.stringify({
			jsonrpc: '2.0',
			id: 'oversized',
			method: 'server/discover',
			params: {},
		})
		const response = await handler.fetch(
			new Request('https://mcp.example.com/mcp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json, text/event-stream',
					'Content-Length': String(4 * 1024 * 1024 + 1),
				},
				body,
			}),
			{ requestLabel: 'oversized' },
			executionContext()
		)

		expect(response.status).toBe(413)
		expect(await responseDocument(response)).toMatchObject({
			error: { code: -32000, message: expect.stringContaining('Request body too large') },
		})
		expect(registrations).toBe(0)
	})

	it('enforces the request body limit when Content-Length is absent', async () => {
		const chunk = new Uint8Array(1024 * 1024)
		let remaining = 5
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (remaining-- > 0) controller.enqueue(chunk)
				else controller.close()
			},
		})
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'streaming-body-limit', version: '1.0.0' },
			register() {},
		})
		const response = await handler.fetch(
			new Request('https://mcp.example.com/mcp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json, text/event-stream',
				},
				body,
			}),
			{ requestLabel: 'streaming-oversized' },
			executionContext()
		)

		expect(response.status).toBe(413)
		expect(await responseDocument(response)).toMatchObject({
			error: { code: -32000, message: expect.stringContaining('Request body too large') },
		})
	})

	it('rejects modern envelope/header mismatches before dispatch', async () => {
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'header-validation', version: '1.0.0' },
			register(context) {
				context.registerTool('ping', { inputSchema: z.object({}) }, async () => ({
					content: [{ type: 'text', text: 'pong' }],
				}))
			},
		})
		const requests = [
			modernRequest('server/discover', {}, { 'MCP-Protocol-Version': '2025-11-25' }),
			modernRequest('server/discover', {}, { 'Mcp-Method': 'tools/list' }),
			modernRequest(
				'tools/call',
				{ name: 'ping', arguments: {} },
				{ 'Mcp-Name': 'different-tool' }
			),
		]

		for (const request of requests) {
			const response = await handler.fetch(
				request,
				{ requestLabel: 'header-mismatch' },
				executionContext()
			)
			expect(response.status).toBe(400)
			expect(await responseDocument(response)).toMatchObject({ error: expect.any(Object) })
		}
	})

	it('records request and tool metrics without waiting for initialize', async () => {
		const events: string[] = []
		const metrics = {
			logEvent(event: MetricsEvent) {
				events.push(event.constructor.name)
			},
		} as MetricsTracker
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'metrics', version: '1.0.0' },
			createMetrics: () => metrics,
			register(context) {
				context.registerTool('ping', { inputSchema: z.object({}) }, async () => ({
					content: [{ type: 'text', text: 'pong' }],
				}))
			},
		})

		const response = await handler.fetch(
			modernRequest('tools/call', { name: 'ping', arguments: {} }),
			{ requestLabel: 'metrics' },
			executionContext()
		)
		expect(response.status).toBe(200)
		expect(events).toEqual(['McpRequest', 'ToolCall'])
	})

	it('plumbs a request-local Sentry client into tool errors', async () => {
		const errors: unknown[] = []
		const sentry = {
			recordError(error: unknown) {
				errors.push(error)
			},
		} as unknown as SentryClient
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'sentry', version: '1.0.0' },
			createSentry: () => sentry,
			register(context) {
				context.registerTool('fail', { inputSchema: z.object({}) }, async () => {
					throw new Error('request-local failure')
				})
			},
		})

		await handler.fetch(
			modernRequest('tools/call', { name: 'fail', arguments: {} }),
			{ requestLabel: 'sentry' },
			executionContext()
		)
		expect(errors).toEqual([expect.objectContaining({ message: 'request-local failure' })])
	})

	it('keeps parallel request props, env, headers, servers, and waitUntil isolated', async () => {
		const contexts: Array<McpRegistrationContext<TestEnv>> = []
		const markStarted: Array<() => void> = []
		const started = [0, 1].map(() => new Promise<void>((resolve) => markStarted.push(resolve)))
		const release: Array<() => void> = []
		const gates = [0, 1].map(() => new Promise<void>((resolve) => release.push(resolve)))
		let calls = 0
		const waitUntilLabels: string[] = []
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'isolation', version: '1.0.0' },
			requireAuth: true,
			register(context) {
				contexts.push(context)
				const call = calls++
				context.accountTool('identity', { inputSchema: z.object({}) }, async (_args, accountId) => {
					markStarted[call]()
					await gates[call]
					context.waitUntil(Promise.resolve())
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									accountId,
									requestLabel: context.env.requestLabel,
									header: context.request.headers.get('x-request-label'),
									userId: context.props?.type === 'user_token' ? context.props.user.id : undefined,
								}),
							},
						],
					}
				})
			},
		})

		const requests = [
			modernRequest(
				'tools/call',
				{ name: 'identity', arguments: {} },
				{ 'cf-account-id': 'account-a', 'x-request-label': 'request-a' }
			),
			modernRequest(
				'tools/call',
				{ name: 'identity', arguments: {} },
				{ 'cf-account-id': 'account-b', 'x-request-label': 'request-b' }
			),
		]
		const requestProps: AuthProps[] = [
			{
				...multiAccountProps,
				accessToken: 'secret-a',
				user: { id: 'user-a', email: 'a@example.com' },
			},
			{
				...multiAccountProps,
				accessToken: 'secret-b',
				user: { id: 'user-b', email: 'b@example.com' },
			},
		]
		const pending = requests.map((request, index) =>
			handler.fetch(
				request,
				{ requestLabel: `env-${index}` },
				executionContext(requestProps[index], () => waitUntilLabels.push(`ctx-${index}`))
			)
		)

		await Promise.all(started)
		// Release in reverse order to force the request-local callbacks to overlap.
		release[1]()
		release[0]()
		const documents = await Promise.all(pending).then((responses) =>
			Promise.all(responses.map(responseDocument))
		)
		const values = documents.map((document) => JSON.parse(textResult(document)))

		expect(values).toEqual([
			{
				accountId: 'account-a',
				requestLabel: 'env-0',
				header: 'request-a',
				userId: 'user-a',
			},
			{
				accountId: 'account-b',
				requestLabel: 'env-1',
				header: 'request-b',
				userId: 'user-b',
			},
		])
		expect(contexts).toHaveLength(2)
		expect(contexts[0]).not.toBe(contexts[1])
		expect(contexts[0]?.registerTool).not.toBe(contexts[1]?.registerTool)
		expect(contexts[0]?.request).not.toBe(contexts[1]?.request)
		expect(waitUntilLabels.sort()).toEqual(['ctx-0', 'ctx-1'])
	})

	it('honors explicit handler auth context when Worker props are absent', async () => {
		let factoryProps: AuthProps | undefined
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'explicit-auth', version: '1.0.0' },
			requireAuth: true,
			handler: { authContext: { props: { ...multiAccountProps } } },
			register(context) {
				factoryProps = context.props
				context.registerTool('auth', { inputSchema: z.object({}) }, async () => ({
					content: [{ type: 'text', text: context.props?.type ?? 'none' }],
				}))
			},
		})

		const response = await handler.fetch(
			modernRequest('tools/call', { name: 'auth', arguments: {} }),
			{ requestLabel: 'explicit-auth' },
			executionContext()
		)

		expect(response.status).toBe(200)
		expect(textResult(await responseDocument(response))).toBe('user_token')
		expect(factoryProps).toEqual(multiAccountProps)
	})

	it('bridges verified OAuth AuthInfo while keeping application props request-scoped', async () => {
		let factoryAuth: AuthInfo | undefined
		let toolAuth: AuthInfo | undefined
		let factoryProps: AuthProps | undefined
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'auth', version: '1.0.0' },
			requireAuth: true,
			register(context) {
				factoryAuth = context.mcp.authInfo
				factoryProps = context.props
				context.registerTool(
					'auth',
					{ inputSchema: z.object({}) },
					async (_args, ctx: ServerContext) => {
						toolAuth = ctx.http?.authInfo
						return { content: [{ type: 'text', text: context.props?.type ?? 'none' }] }
					}
				)
			},
		})
		const auth = {
			token: 'provider-token',
			clientId: 'client-1',
			scopes: ['read'],
			expiresAt: 2_000_000_000,
			resource: new URL('https://mcp.example.com/mcp'),
		}
		const response = await handler.fetch(
			modernRequest('tools/call', { name: 'auth', arguments: {} }),
			{ requestLabel: 'auth' },
			verifiedExecutionContext(multiAccountProps, auth)
		)

		expect(response.status).toBe(200)
		expect(textResult(await responseDocument(response))).toBe('user_token')
		expect(factoryProps).toEqual(multiAccountProps)
		expect(factoryAuth).toMatchObject({ clientId: 'client-1', scopes: ['read'] })
		expect(toolAuth).toMatchObject({ clientId: 'client-1', scopes: ['read'] })
		expect(factoryAuth?.extra?.props).toEqual(multiAccountProps)
	})

	it('allows browser account selection and modern headers in CORS, and validates Host', async () => {
		const handler = createCloudflareMcpHandler<TestEnv>({
			serverInfo: { name: 'http', version: '1.0.0' },
			register() {},
			handler: {
				allowedHostnames: ['mcp.example.com'],
				allowedOriginHostnames: ['app.example.com'],
				corsOptions: { origin: 'https://app.example.com' },
			},
		})
		const preflight = await handler.fetch(
			new Request('https://mcp.example.com/mcp', {
				method: 'OPTIONS',
				headers: { Host: 'mcp.example.com', Origin: 'https://app.example.com' },
			}),
			{ requestLabel: 'cors' },
			executionContext()
		)
		const allowedHeaders = preflight.headers.get('Access-Control-Allow-Headers')?.toLowerCase()

		expect(preflight.status).toBe(200)
		expect(allowedHeaders).toContain('cf-account-id')
		expect(allowedHeaders).toContain('mcp-method')
		expect(allowedHeaders).toContain('mcp-name')

		const rejected = modernRequest('server/discover')
		rejected.headers.set('Host', 'evil.example.com')
		const response = await handler.fetch(rejected, { requestLabel: 'host' }, executionContext())
		expect(response.status).toBe(403)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')

		const invalidOrigin = modernRequest(
			'server/discover',
			{},
			{
				Origin: 'https://evil.example.com',
			}
		)
		invalidOrigin.headers.set('Host', 'mcp.example.com')
		const originResponse = await handler.fetch(
			invalidOrigin,
			{ requestLabel: 'origin' },
			executionContext()
		)
		expect(originResponse.status).toBe(403)
	})
})
