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
	it('distinguishes external API tokens from provider-issued tokens', async () => {
		expect(await isApiTokenRequest(request('opaque-api-token'), env)).toBe(true)
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
