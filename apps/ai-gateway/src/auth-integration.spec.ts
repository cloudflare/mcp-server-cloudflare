import { getOAuthApi } from '@cloudflare/workers-oauth-provider'
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
	// The worker's own provider configuration, so tokens minted here validate there.
	return {
		apiRoute: '/mcp',
		apiHandler: { fetch: () => new Response('unused') },
		defaultHandler: { fetch: () => new Response('unused') },
		authorizeEndpoint: '/oauth/authorize',
		tokenEndpoint: '/token',
		resourceMetadata: { resource: endpoint },
	}
}

async function s256(value: string): Promise<string> {
	const digest = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	)
	return btoa(String.fromCharCode(...digest))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

/** Complete an authorization with the provider helpers, then redeem the code at the worker's /token. */
async function issueOAuthToken() {
	const helpers = getOAuthApi(helperOptions(), testEnv)
	const client = await helpers.createClient({
		redirectUris: ['https://client.example.com/callback'],
		tokenEndpointAuthMethod: 'none',
	})
	const verifier = 'auth-integration-verifier-'.repeat(3)
	const { redirectTo } = await helpers.completeAuthorization({
		request: {
			responseType: 'code',
			clientId: client.clientId,
			redirectUri: client.redirectUris[0],
			scope: ['account:read', 'aig:read'],
			state: 'test-state',
			codeChallenge: await s256(verifier),
			codeChallengeMethod: 'S256',
			resource: endpoint,
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
	const code = new URL(redirectTo).searchParams.get('code')
	if (!code) throw new Error('OAuth helper did not issue an authorization code')

	const response = await worker.fetch(
		new Request('https://ai-gateway.mcp.cloudflare.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: client.redirectUris[0],
				client_id: client.clientId,
				code_verifier: verifier,
			}),
		}),
		testEnv,
		executionContext()
	)
	const { access_token: token } = (await response.json()) as { access_token?: string }
	if (!token) throw new Error(`Token endpoint did not issue an access token (${response.status})`)
	return token
}

afterEach(async () => {
	vi.unstubAllGlobals()
	getCloudflareClientMock.mockClear()
	await reset()
})

describe('AI Gateway exported Worker authentication', () => {
	it('bridges a provider-validated OAuth token into a fresh SDK server and real tool call', async () => {
		const token = await issueOAuthToken()
		const response = await worker.fetch(toolRequest(token), testEnv, executionContext())
		const document = await responseDocument(response)

		expect(response.status).toBe(200)
		expect(response.headers.get('mcp-session-id')).toBeNull()
		expect(document.result.content[0].text).toContain('oauth-account:oauth-upstream-token')
		expect(getCloudflareClientMock).toHaveBeenCalledWith('oauth-upstream-token')
	})

	it('answers /sse with a 410 naming /mcp, even with a valid OAuth token', async () => {
		const token = await issueOAuthToken()
		const response = await worker.fetch(
			toolRequest(token, 'https://ai-gateway.mcp.cloudflare.com/sse'),
			testEnv,
			executionContext()
		)

		expect(response.status).toBe(410)
		expect(await response.json()).toMatchObject({ url: endpoint })
		expect(getCloudflareClientMock).not.toHaveBeenCalled()
	})

	it('publishes /mcp as the protected resource', async () => {
		const response = await worker.fetch(
			new Request('https://ai-gateway.mcp.cloudflare.com/.well-known/oauth-protected-resource/mcp'),
			testEnv,
			executionContext()
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ resource: endpoint })
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
