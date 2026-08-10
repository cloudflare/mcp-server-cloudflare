import { resourceMatches } from '@cloudflare/workers-oauth-provider'
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
const env = {
	DEV_CLOUDFLARE_API_TOKEN: '',
	DEV_CLOUDFLARE_EMAIL: '',
	DEV_DISABLE_OAUTH: 'false',
} as CloudflareOAuthEnv
const executionContext = {
	props: {},
	waitUntil() {},
	passThroughOnException() {},
} as ExecutionContext

describe('OAuth router resource policy', () => {
	it('uses exact RFC 8707 matching for same-origin resource paths', () => {
		expect(
			resourceMatches('https://mcp.example.com/other', 'https://mcp.example.com/mcp', false)
		).toBe(false)
		expect(
			resourceMatches('https://mcp.example.com/mcp', 'https://mcp.example.com/mcp', false)
		).toBe(true)
	})

	it('rejects the expired origin-only compatibility override', () => {
		expect(() =>
			createCloudflareOAuthRouter<CloudflareOAuthEnv>({
				apiHandler,
				scopes: {},
				metrics,
				mcpRequestPolicy,
				provider: { resourceMatchOriginOnly: true } as never,
			})
		).toThrow('resourceMatchOriginOnly')
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
			env,
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
			env,
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
})
