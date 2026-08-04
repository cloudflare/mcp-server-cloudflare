import { getOAuthApi, OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { env, reset } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './ai-gateway.app'

import type { OAuthProviderOptions } from '@cloudflare/workers-oauth-provider'
import type { Env } from './ai-gateway.context'

const { getCloudflareClientMock } = vi.hoisted(() => ({
	getCloudflareClientMock: vi.fn((token: string) => ({
		aiGateway: {
			async list({ account_id }: { account_id: string }) {
				return {
					result: [{ id: `${account_id}:${token}` }],
					result_info: { page: 1, per_page: 20, count: 1, total_count: 1 },
				}
			},
		},
	})),
}))

vi.mock('@repo/mcp-common/src/cloudflare-api', () => ({
	getCloudflareClient: getCloudflareClientMock,
}))

const endpoint = 'https://ai-gateway.mcp.cloudflare.com/mcp'
const testEnv = env as unknown as Env

function executionContext(): ExecutionContext {
	return {
		props: {},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

function toolRequest(token: string, url = endpoint) {
	return new Request(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/call',
			'Mcp-Name': 'list_gateways',
			Host: 'ai-gateway.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: crypto.randomUUID(),
			method: 'tools/call',
			params: {
				name: 'list_gateways',
				arguments: {},
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'auth-integration', version: '1.0.0' },
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

function helperOptions(): OAuthProviderOptions<Env> {
	return {
		apiRoute: '/mcp',
		apiHandler: { fetch: () => new Response('unused') },
		defaultHandler: { fetch: () => new Response('unused') },
		authorizeEndpoint: '/oauth/authorize',
		tokenEndpoint: '/token',
	}
}

async function s256Challenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

async function issueOAuthToken(resource: string) {
	const options = helperOptions()
	const helpers = getOAuthApi(options, testEnv)
	const client = await helpers.createClient({
		redirectUris: ['https://client.example.com/callback'],
		tokenEndpointAuthMethod: 'none',
	})
	const codeVerifier = 'a'.repeat(43)
	const result = await helpers.completeAuthorization({
		request: {
			responseType: 'code',
			clientId: client.clientId,
			redirectUri: client.redirectUris[0],
			scope: ['account:read', 'aig:read'],
			state: 'test-state',
			codeChallenge: await s256Challenge(codeVerifier),
			codeChallengeMethod: 'S256',
			resource,
		},
		userId: 'oauth-user',
		metadata: {},
		scope: ['account:read', 'aig:read'],
		props: {
			type: 'account_token',
			accessToken: 'oauth-upstream-token',
			account: { id: 'oauth-account', name: 'OAuth account' },
		},
	})
	const code = new URL(result.redirectTo).searchParams.get('code')
	if (!code) throw new Error('OAuth helper did not issue an authorization code')

	const provider = new OAuthProvider(options)
	const tokenResponse = await provider.fetch(
		new Request('https://ai-gateway.mcp.cloudflare.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: client.redirectUris[0],
				client_id: client.clientId,
				code_verifier: codeVerifier,
				resource,
			}),
		}),
		testEnv,
		executionContext()
	)
	const tokenDocument = (await tokenResponse.json()) as { access_token?: string }
	if (tokenResponse.status !== 200 || !tokenDocument.access_token) {
		throw new Error(`OAuth token exchange failed: ${tokenResponse.status}`)
	}
	return tokenDocument.access_token
}

afterEach(async () => {
	vi.unstubAllGlobals()
	getCloudflareClientMock.mockClear()
	await reset()
})

describe('AI Gateway exported Worker authentication', () => {
	it('bridges a provider-validated OAuth token into a fresh SDK server and real tool call', async () => {
		const token = await issueOAuthToken(endpoint)
		const response = await worker.fetch(toolRequest(token), testEnv, executionContext())
		const document = await responseDocument(response)

		expect(response.status).toBe(200)
		expect(response.headers.get('mcp-session-id')).toBeNull()
		expect(document.result.content[0].text).toContain('oauth-account:oauth-upstream-token')
		expect(getCloudflareClientMock).toHaveBeenCalledWith('oauth-upstream-token')
	})

	it('serves the /sse URL through the same stateless handler with path-bound OAuth', async () => {
		const sseEndpoint = 'https://ai-gateway.mcp.cloudflare.com/sse'
		const token = await issueOAuthToken(sseEndpoint)
		const response = await worker.fetch(
			toolRequest(token, sseEndpoint),
			testEnv,
			executionContext()
		)
		const document = await responseDocument(response)

		expect(response.status).toBe(200)
		expect(response.headers.get('mcp-session-id')).toBeNull()
		expect(document.result.content[0].text).toContain('oauth-account:oauth-upstream-token')
		expect(getCloudflareClientMock).toHaveBeenCalledWith('oauth-upstream-token')
	})

	it('rejects an OAuth token bound to a different path on the same origin', async () => {
		const token = await issueOAuthToken('https://ai-gateway.mcp.cloudflare.com/other')
		const response = await worker.fetch(toolRequest(token), testEnv, executionContext())

		expect(response.status).toBe(401)
		expect(await response.json()).toMatchObject({ error: 'invalid_token' })
		expect(getCloudflareClientMock).not.toHaveBeenCalled()
	})

	it('validates parallel API tokens through the exported Worker without leaking request props', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = new URL(input instanceof Request ? input.url : input.toString())
				const authorization = new Headers(init?.headers).get('Authorization') ?? ''
				const token = authorization.replace(/^Bearer /, '')
				if (url.pathname === '/client/v4/user') {
					return Response.json({
						success: true,
						result: { id: `user-${token}`, email: `${token}@example.com` },
						errors: [],
						messages: [],
					})
				}
				if (url.pathname === '/client/v4/accounts') {
					return Response.json({
						success: true,
						result: [{ id: `account-${token}`, name: token }],
						errors: [],
						messages: [],
					})
				}
				throw new Error(`Unexpected fetch: ${url}`)
			})
		)

		const tokens = ['a'.repeat(40), 'b'.repeat(40)]
		const [first, second] = await Promise.all(
			tokens.map((token) => worker.fetch(toolRequest(token), testEnv, executionContext()))
		)
		const documents = await Promise.all([responseDocument(first), responseDocument(second)])

		expect([first.status, second.status]).toEqual([200, 200])
		expect(documents[0].result.content[0].text).toContain(`account-${tokens[0]}:${tokens[0]}`)
		expect(documents[1].result.content[0].text).toContain(`account-${tokens[1]}:${tokens[1]}`)
		expect(getCloudflareClientMock).toHaveBeenCalledWith(tokens[0])
		expect(getCloudflareClientMock).toHaveBeenCalledWith(tokens[1])
	})
})
