import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { createCloudflareOAuthRouter } from './oauth-router'
import { server } from './test/msw-server'

import type { MetricsTracker } from '@repo/mcp-observability'
import type { CloudflareOAuthEnv } from './oauth-router'

const apiHandler = {
	fetch() {
		return new Response('ok')
	},
}

const metrics = { logEvent() {} } as unknown as MetricsTracker
const mcpRequestPolicy = {
	allowedHostnames: ['mcp.example.com'],
	allowedOriginHostnames: ['mcp.example.com'],
}
function testEnv() {
	const store = new Map<string, string>()
	return {
		DEV_CLOUDFLARE_API_TOKEN: '',
		DEV_CLOUDFLARE_EMAIL: '',
		DEV_DISABLE_OAUTH: 'false',
		OAUTH_KV: {
			async get(key: string) {
				const value = store.get(key)
				return value === undefined ? null : JSON.parse(value)
			},
			async put(key: string, value: string) {
				store.set(key, value)
			},
		} as unknown as KVNamespace,
	} as CloudflareOAuthEnv
}
const executionContext = {
	props: {},
	waitUntil() {},
	passThroughOnException() {},
} as ExecutionContext

describe('OAuth router resource policy', () => {
	it('publishes <origin>/mcp as the one protected resource', async () => {
		const router = createCloudflareOAuthRouter<CloudflareOAuthEnv>({
			apiHandler,
			scopes: {},
			metrics,
			mcpRequestPolicy,
		})

		const response = await router.fetch(
			new Request('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
			testEnv(),
			executionContext
		)

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toMatchObject({
			resource: 'https://mcp.example.com/mcp',
			authorization_servers: ['https://mcp.example.com'],
		})
	})

	it('sends every /sse request to the handler before OAuth, with or without a token', async () => {
		const router = createCloudflareOAuthRouter<CloudflareOAuthEnv>({
			apiHandler: {
				fetch() {
					return new Response('moved', { status: 410 })
				},
			},
			scopes: {},
			metrics,
			mcpRequestPolicy,
		})

		const requests: Array<{ method: string; headers: Record<string, string> }> = [
			{ method: 'GET', headers: { Accept: 'text/event-stream' } },
			{ method: 'POST', headers: {} },
			{ method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(40)}` } },
		]
		for (const init of requests) {
			const response = await router.fetch(
				new Request('https://mcp.example.com/sse', {
					...init,
					headers: { ...init.headers, Host: 'mcp.example.com' },
				}),
				testEnv(),
				executionContext
			)
			expect(response.status).toBe(410)
			await expect(response.text()).resolves.toBe('moved')
		}
	})

	it('returns a retryable response when a Wrangler OAuth identity probe is rate limited', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 429, headers: { 'Retry-After': '17' } })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({
					success: true,
					result: [{ id: 'account-1', name: 'Account One' }],
					errors: [],
					messages: [],
				})
			)
		)
		const router = createCloudflareOAuthRouter<CloudflareOAuthEnv>({
			apiHandler,
			scopes: {},
			metrics,
			mcpRequestPolicy,
		})

		const response = await router.fetch(
			new Request('https://mcp.example.com/mcp', {
				headers: {
					Authorization: 'Bearer cfoat_test-wrangler-token',
					Host: 'mcp.example.com',
				},
			}),
			testEnv(),
			executionContext
		)

		expect(response.status).toBe(429)
		expect(response.headers.get('retry-after')).toBe('17')
		await expect(response.json()).resolves.toEqual({
			error: 'temporarily_unavailable',
			error_description: 'Rate limited, try again later',
		})
	})

	it('returns 401 instead of throwing when a direct token is malformed', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 400 })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({ success: false }, { status: 400 })
			)
		)
		const router = createCloudflareOAuthRouter<CloudflareOAuthEnv>({
			apiHandler,
			scopes: {},
			metrics,
			mcpRequestPolicy,
		})

		const response = await router.fetch(
			new Request('https://mcp.example.com/mcp', {
				headers: {
					Authorization: 'Bearer malformed-token',
					Host: 'mcp.example.com',
				},
			}),
			testEnv(),
			executionContext
		)

		expect(response.status).toBe(401)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(response.headers.get('www-authenticate')).toBe(
			'Bearer realm="OAuth", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp", error="invalid_token"'
		)
		await expect(response.json()).resolves.toEqual({
			error: 'invalid_token',
			error_description: 'Access token appears malformed; reauthenticate and try again',
		})
	})

	it('serves /mcp with a direct API token through the provider hook', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({
					success: true,
					result: { id: 'user-1', email: 'user@example.com' },
					errors: [],
					messages: [],
				})
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({
					success: true,
					result: [{ id: 'account-1', name: 'Account One' }],
					errors: [],
					messages: [],
				})
			)
		)
		const router = createCloudflareOAuthRouter<CloudflareOAuthEnv>({
			apiHandler,
			scopes: {},
			metrics,
			mcpRequestPolicy,
		})

		const response = await router.fetch(
			new Request('https://mcp.example.com/mcp', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${'a'.repeat(40)}`,
					Host: 'mcp.example.com',
				},
			}),
			testEnv(),
			executionContext
		)

		expect(response.status).toBe(200)
		await expect(response.text()).resolves.toBe('ok')
	})
})
