import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { getApiTokenProps, handleApiTokenMode, isApiTokenRequest } from './api-token-mode'
import { server } from './test/msw-server'

const env = {
	DEV_CLOUDFLARE_API_TOKEN: '',
	DEV_CLOUDFLARE_EMAIL: '',
	DEV_DISABLE_OAUTH: 'false',
}

function request(token = 'api-token') {
	return new Request('https://mcp.example.com/mcp', {
		headers: { Authorization: `Bearer ${token}` },
	})
}

function mockCloudflareIdentity() {
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
}

describe('API-token request scope', () => {
	it('distinguishes Cloudflare bearer credentials from MCP provider tokens', async () => {
		expect(await isApiTokenRequest(request('cfut_test-user-token'), env)).toBe(true)
		expect(await isApiTokenRequest(request('cfat_test-account-token'), env)).toBe(true)
		expect(await isApiTokenRequest(request('cfoat_test-wrangler-token'), env)).toBe(true)
		expect(await isApiTokenRequest(request('a'.repeat(40)), env)).toBe(true)
		expect(await isApiTokenRequest(request('legacy-unknown-shape'), env)).toBe(true)
		expect(await isApiTokenRequest(request('user:grant:secret'), env)).toBe(false)
	})

	it('validates the token into the shared AuthProps shape', async () => {
		mockCloudflareIdentity()
		expect(await getApiTokenProps(request(), env)).toEqual({
			type: 'user_token',
			accessToken: 'api-token',
			user: { id: 'user-1', email: 'user@example.com' },
			accounts: [{ id: 'account-1', name: 'Account One' }],
		})
	})

	it('uses only the accounts probe for a prefixed account token', async () => {
		let userCalls = 0
		let accountsCalls = 0
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () => {
				userCalls += 1
				return HttpResponse.json({ success: false }, { status: 500 })
			}),
			http.get('https://api.cloudflare.com/client/v4/accounts', () => {
				accountsCalls += 1
				return HttpResponse.json({
					success: true,
					result: [{ id: 'account-1', name: 'Account One' }],
					errors: [],
					messages: [],
				})
			})
		)

		await expect(getApiTokenProps(request('cfat_test-account-token'), env)).resolves.toEqual({
			type: 'account_token',
			accessToken: 'cfat_test-account-token',
			account: { id: 'account-1', name: 'Account One' },
		})
		expect(userCalls).toBe(0)
		expect(accountsCalls).toBe(1)
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

		await expect(getApiTokenProps(request('cfat_test-account-token'), env)).rejects.toMatchObject({
			code: 401,
		})
	})

	it('keeps both identity probes for user, Wrangler OAuth, and legacy tokens', async () => {
		let userCalls = 0
		let accountsCalls = 0
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () => {
				userCalls += 1
				return HttpResponse.json({
					success: true,
					result: { id: 'user-1', email: 'user@example.com' },
					errors: [],
					messages: [],
				})
			}),
			http.get('https://api.cloudflare.com/client/v4/accounts', () => {
				accountsCalls += 1
				return HttpResponse.json({
					success: true,
					result: [{ id: 'account-1', name: 'Account One' }],
					errors: [],
					messages: [],
				})
			})
		)

		await getApiTokenProps(request('cfut_test-user-token'), env)
		await getApiTokenProps(request('cfoat_test-wrangler-token'), env)
		await getApiTokenProps(request('l'.repeat(40)), env)
		expect(userCalls).toBe(3)
		expect(accountsCalls).toBe(3)
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
			fetch(_request: Request, _env: typeof env, requestCtx: ExecutionContext) {
				seenProps = requestCtx.props
				return new Response('ok')
			},
		}

		const response = await handleApiTokenMode(handler, request(), env, ctx)
		expect(await response.text()).toBe('ok')
		expect(seenProps).toMatchObject({ type: 'user_token', accessToken: 'api-token' })
		expect(ctx.props).toBe(seenProps)
	})
})
