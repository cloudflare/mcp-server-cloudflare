import { ExternalTokenError } from '@cloudflare/workers-oauth-provider'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
	cloudflareTokenOwner,
	devApiTokenModeEnabled,
	handleDevApiTokenMode,
	resolveExternalToken,
} from './api-token-mode'
import { server } from './test/msw-server'

function kvStub() {
	const store = new Map<string, string>()
	return {
		store,
		namespace: {
			async get(key: string) {
				const value = store.get(key)
				return value === undefined ? null : JSON.parse(value)
			},
			async put(key: string, value: string) {
				store.set(key, value)
			},
		} as unknown as KVNamespace,
	}
}

function resolveInput(token: string, kv: KVNamespace) {
	return {
		token,
		request: new Request('https://mcp.example.com/mcp'),
		env: { OAUTH_KV: kv },
	}
}

function mockCloudflareIdentity() {
	const calls = { user: 0, accounts: 0 }
	server.use(
		http.get('https://api.cloudflare.com/client/v4/user', () => {
			calls.user += 1
			return HttpResponse.json({
				success: true,
				result: { id: 'user-1', email: 'user@example.com' },
				errors: [],
				messages: [],
			})
		}),
		http.get('https://api.cloudflare.com/client/v4/accounts', () => {
			calls.accounts += 1
			return HttpResponse.json({
				success: true,
				result: [{ id: 'account-1', name: 'Account One' }],
				errors: [],
				messages: [],
			})
		})
	)
	return calls
}

describe('cloudflareTokenOwner', () => {
	it('reads documented credential ownership prefixes as hints', () => {
		expect(cloudflareTokenOwner('cfat_test-account-token')).toBe('account')
		expect(cloudflareTokenOwner('cfut_test-user-token')).toBe('user')
		expect(cloudflareTokenOwner('cfoat_test-wrangler-token')).toBe('user')
		expect(cloudflareTokenOwner('legacy-unknown-shape')).toBe('unknown')
	})
})

describe('resolveExternalToken', () => {
	it('validates the token into the shared AuthProps shape', async () => {
		mockCloudflareIdentity()
		await expect(
			resolveExternalToken(resolveInput('api-token', kvStub().namespace))
		).resolves.toEqual({
			props: {
				type: 'user_token',
				accessToken: 'api-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ id: 'account-1', name: 'Account One' }],
			},
		})
	})

	it('caches a verified identity so repeat requests skip the probes', async () => {
		const calls = mockCloudflareIdentity()
		const kv = kvStub()

		const first = await resolveExternalToken(resolveInput('secret-credential', kv.namespace))
		const second = await resolveExternalToken(resolveInput('secret-credential', kv.namespace))

		expect(second).toEqual(first)
		expect(calls).toEqual({ user: 1, accounts: 1 })
		expect(kv.store.size).toBe(1)
		const [cacheKey] = [...kv.store.keys()]
		expect(cacheKey).toMatch(/^api-token-identity:v1:[0-9a-f]{64}$/)
		expect(cacheKey).not.toContain('secret-credential')
	})

	it('ignores a cache entry that does not match the expected shape', async () => {
		const calls = mockCloudflareIdentity()
		const kv = kvStub()

		await resolveExternalToken(resolveInput('api-token', kv.namespace))
		const [cacheKey] = [...kv.store.keys()]
		kv.store.set(cacheKey, JSON.stringify({ unexpected: true }))

		await expect(resolveExternalToken(resolveInput('api-token', kv.namespace))).resolves.toEqual({
			props: {
				type: 'user_token',
				accessToken: 'api-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ id: 'account-1', name: 'Account One' }],
			},
		})
		expect(calls).toEqual({ user: 2, accounts: 2 })
	})

	it('uses only the accounts probe for a prefixed account token', async () => {
		const calls = mockCloudflareIdentity()

		await expect(
			resolveExternalToken(resolveInput('cfat_test-account-token', kvStub().namespace))
		).resolves.toEqual({
			props: {
				type: 'account_token',
				accessToken: 'cfat_test-account-token',
				account: { id: 'account-1', name: 'Account One' },
			},
		})
		expect(calls).toEqual({ user: 0, accounts: 1 })
	})

	it('rejects a prefixed account token that does not resolve to exactly one account', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({
					success: true,
					result: [
						{ id: 'account-1', name: 'Account One' },
						{ id: 'account-2', name: 'Account Two' },
					],
					errors: [],
					messages: [],
				})
			)
		)

		await expect(
			resolveExternalToken(resolveInput('cfat_test-account-token', kvStub().namespace))
		).rejects.toMatchObject({
			name: 'ExternalTokenError',
			code: 'invalid_token',
			statusCode: 401,
		})
	})

	it('preserves Retry-After when an identity probe is rate limited', async () => {
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

		await expect(
			resolveExternalToken(resolveInput('cfoat_test-wrangler-token', kvStub().namespace))
		).rejects.toMatchObject({
			code: 'temporarily_unavailable',
			statusCode: 429,
			headers: { 'Retry-After': '17' },
		})
	})

	it('maps malformed-token 400s to a structured invalid_token error', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 400 })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({ success: false }, { status: 400 })
			)
		)

		const rejection = await resolveExternalToken(
			resolveInput('malformed-token', kvStub().namespace)
		).then(
			() => {
				throw new Error('expected resolveExternalToken to reject')
			},
			(error: unknown) => error
		)
		expect(rejection).toBeInstanceOf(ExternalTokenError)
		expect(rejection).toMatchObject({
			code: 'invalid_token',
			statusCode: 401,
			description: 'Access token appears malformed; reauthenticate and try again',
		})
	})

	it('maps insufficient permissions to insufficient_scope with step-up guidance', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 403 })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({ success: false }, { status: 403 })
			)
		)

		await expect(
			resolveExternalToken(resolveInput('l'.repeat(40), kvStub().namespace))
		).rejects.toMatchObject({
			code: 'insufficient_scope',
			statusCode: 403,
			requiredScopes: ['user:read', 'account:read'],
		})
	})
})

describe('local development API-token mode', () => {
	const devEnv = {
		DEV_CLOUDFLARE_API_TOKEN: 'dev-token',
		DEV_CLOUDFLARE_EMAIL: 'dev@example.com',
		DEV_DISABLE_OAUTH: 'true',
	}

	it('activates only when a token is configured and OAuth is disabled', () => {
		expect(devApiTokenModeEnabled(devEnv)).toBe(true)
		expect(devApiTokenModeEnabled({ ...devEnv, DEV_DISABLE_OAUTH: 'false' })).toBe(false)
		expect(devApiTokenModeEnabled({ ...devEnv, DEV_CLOUDFLARE_API_TOKEN: '' })).toBe(false)
	})

	it('sets props only on the request ExecutionContext passed to the stateless handler', async () => {
		mockCloudflareIdentity()
		const ctx = {
			props: {},
			waitUntil() {},
			passThroughOnException() {},
		} as ExecutionContext
		let seenProps: unknown
		const handler = {
			fetch(_request: Request, _env: typeof devEnv, requestCtx: ExecutionContext) {
				seenProps = requestCtx.props
				return new Response('ok')
			},
		}

		const response = await handleDevApiTokenMode(
			handler,
			new Request('https://localhost/mcp'),
			devEnv,
			ctx
		)
		expect(await response.text()).toBe('ok')
		expect(seenProps).toMatchObject({ type: 'user_token', accessToken: 'dev-token' })
		expect(ctx.props).toBe(seenProps)
	})

	it('returns a structured error instead of throwing when the dev token is rejected', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 401 })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({ success: false }, { status: 401 })
			)
		)
		const ctx = {
			props: {},
			waitUntil() {},
			passThroughOnException() {},
		} as ExecutionContext
		const handler = {
			fetch() {
				return new Response('ok')
			},
		}

		const response = await handleDevApiTokenMode(
			handler,
			new Request('https://localhost/mcp'),
			devEnv,
			ctx
		)
		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({
			error: 'invalid_token',
			error_description: 'Access token is invalid or expired',
		})
	})
})

describe('identity cache safety', () => {
	it('never caches a failed verification and re-probes after recovery', async () => {
		const kv = kvStub()
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({ success: false }, { status: 401 })
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () =>
				HttpResponse.json({ success: false }, { status: 401 })
			)
		)

		await expect(
			resolveExternalToken(resolveInput('cfut_recovering-token', kv.namespace))
		).rejects.toMatchObject({ code: 'invalid_token' })
		expect(kv.store.size).toBe(0)

		const calls = mockCloudflareIdentity()
		await expect(
			resolveExternalToken(resolveInput('cfut_recovering-token', kv.namespace))
		).resolves.toMatchObject({ props: { type: 'user_token' } })
		expect(calls).toEqual({ user: 1, accounts: 1 })
		expect(kv.store.size).toBe(1)
	})

	it('serves but never caches an identity degraded by an unparseable payload', async () => {
		const kv = kvStub()
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () =>
				HttpResponse.json({
					success: true,
					result: { id: 'user-1', email: 'user@example.com' },
					errors: [],
					messages: [],
				})
			),
			http.get('https://api.cloudflare.com/client/v4/accounts', () => HttpResponse.text('not json'))
		)

		await expect(resolveExternalToken(resolveInput('api-token', kv.namespace))).resolves.toEqual({
			props: {
				type: 'user_token',
				accessToken: 'api-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [],
			},
		})
		expect(kv.store.size).toBe(0)
	})

	it('verifies the credential even when the cache itself is unavailable', async () => {
		const calls = mockCloudflareIdentity()
		const brokenKv = {
			async get() {
				throw new Error('KV read outage')
			},
			async put() {
				throw new Error('KV write outage')
			},
		} as unknown as KVNamespace

		await expect(resolveExternalToken(resolveInput('api-token', brokenKv))).resolves.toMatchObject({
			props: { type: 'user_token' },
		})
		expect(calls).toEqual({ user: 1, accounts: 1 })
	})
})
