import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'
import { server } from './test/msw-server'

const TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'

const validTokenResponse = {
	access_token: 'test-access-token',
	expires_in: 3600,
	refresh_token: 'test-refresh-token',
	scope: 'read write',
	token_type: 'bearer',
}

describe('getAuthToken', () => {
	const baseParams = {
		client_id: 'test-client-id',
		client_secret: 'test-client-secret',
		redirect_uri: 'https://example.com/callback',
		code_verifier: 'test-verifier',
		code: 'test-code',
	}

	it('throws McpError 400 for missing code', async () => {
		try {
			await getAuthToken({ ...baseParams, code: '' })
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			expect((e as McpError).code).toBe(400)
		}
	})

	it('returns parsed token on success', async () => {
		server.use(http.post(TOKEN_ENDPOINT, () => HttpResponse.json(validTokenResponse)))

		const result = await getAuthToken(baseParams)
		expect(result.access_token).toBe('test-access-token')
		expect(result.refresh_token).toBe('test-refresh-token')
		expect(result.expires_in).toBe(3600)
	})

	it('throws McpError with upstream status for 400 (expired/invalid grant)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'invalid_grant',
						error_description: 'The authorization code has expired',
					}),
					{ status: 400 }
				)
			)
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(400)
			expect(err.message).toBe('Authorization grant is invalid, expired, or revoked')
			expect(err.reportToSentry).toBe(false)
			expect(err.internalMessage).toContain('Upstream 400')
			expect(err.internalMessage).toContain('The authorization code has expired')
		}
	})

	it('throws McpError with upstream status for 401 (bad client credentials)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'invalid_client',
						error_description: 'Invalid client credentials',
					}),
					{ status: 401 }
				)
			)
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(401)
			expect(err.message).toBe('Client authentication failed')
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError with upstream status for 403 (insufficient permissions)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'access_denied',
						error_description: 'Insufficient permissions',
					}),
					{ status: 403 }
				)
			)
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(403)
			expect(err.message).toBe('Access denied')
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError with upstream status for 429 (rate limited)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'rate_limited',
						error_description: 'Too many requests',
					}),
					{ status: 429 }
				)
			)
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(429)
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError 502 for upstream 500 (server error)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () => HttpResponse.text('Internal Server Error', { status: 500 }))
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(502)
			expect(err.message).toBe('Upstream token service unavailable')
			expect(err.reportToSentry).toBe(true)
			expect(err.internalMessage).toContain('Upstream 500')
		}
	})

	it('throws McpError 502 for upstream 503 (service unavailable)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () => HttpResponse.text('Service Unavailable', { status: 503 }))
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(502)
			expect(err.reportToSentry).toBe(true)
		}
	})

	it('uses fallback message when upstream body is not JSON', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text('Bad Request - plain text', { status: 400 })
			)
		)

		try {
			await getAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(400)
			expect(err.message).toBe('Token exchange failed')
			expect(err.reportToSentry).toBe(false)
		}
	})
})

describe('refreshAuthToken', () => {
	const baseParams = {
		client_id: 'test-client-id',
		client_secret: 'test-client-secret',
		refresh_token: 'test-refresh-token',
	}

	it('returns parsed token on success', async () => {
		server.use(http.post(TOKEN_ENDPOINT, () => HttpResponse.json(validTokenResponse)))

		const result = await refreshAuthToken(baseParams)
		expect(result.access_token).toBe('test-access-token')
		expect(result.refresh_token).toBe('test-refresh-token')
	})

	it('throws McpError with upstream status for 400 (expired refresh token)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'invalid_grant',
						error_description: 'The refresh token has expired',
					}),
					{ status: 400 }
				)
			)
		)

		try {
			await refreshAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(400)
			expect(err.message).toBe('Authorization grant is invalid, expired, or revoked')
			expect(err.reportToSentry).toBe(false)
			expect(err.internalMessage).toContain('Upstream 400')
			expect(err.internalMessage).toContain('The refresh token has expired')
		}
	})

	it('throws McpError with upstream status for 401 (invalid client)', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'invalid_client',
						error_description: 'Bad client credentials',
					}),
					{ status: 401 }
				)
			)
		)

		try {
			await refreshAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(401)
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError 502 for upstream 500', async () => {
		server.use(http.post(TOKEN_ENDPOINT, () => HttpResponse.text('Server Error', { status: 500 })))

		try {
			await refreshAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(502)
			expect(err.message).toBe('Upstream token service unavailable')
			expect(err.reportToSentry).toBe(true)
		}
	})

	it('uses fallback message when upstream error code is unknown', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(JSON.stringify({ error: 'some_unknown_error' }), { status: 400 })
			)
		)

		try {
			await refreshAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(400)
			expect(err.message).toBe('Token refresh failed')
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('maps known error codes to safe messages instead of forwarding error_description', async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, () =>
				HttpResponse.text(
					JSON.stringify({
						error: 'invalid_grant',
						error_description: 'Internal: token xyz expired at 2024-01-01',
					}),
					{ status: 400 }
				)
			)
		)

		try {
			await refreshAuthToken(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.message).toBe('Authorization grant is invalid, expired, or revoked')
			// Raw upstream detail preserved in internalMessage only
			expect(err.internalMessage).toContain('Internal: token xyz expired')
		}
	})
})
