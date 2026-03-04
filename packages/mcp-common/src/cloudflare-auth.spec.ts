import { fetchMock } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

import { getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'

beforeAll(() => {
	fetchMock.activate()
	fetchMock.disableNetConnect()
})

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(200, validTokenResponse)

		const result = await getAuthToken(baseParams)
		expect(result.access_token).toBe('test-access-token')
		expect(result.refresh_token).toBe('test-refresh-token')
		expect(result.expires_in).toBe(3600)
	})

	it('throws McpError with upstream status for 400 (expired/invalid grant)', async () => {
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				400,
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'The authorization code has expired',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				401,
				JSON.stringify({
					error: 'invalid_client',
					error_description: 'Invalid client credentials',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				403,
				JSON.stringify({
					error: 'access_denied',
					error_description: 'Insufficient permissions',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				429,
				JSON.stringify({
					error: 'rate_limited',
					error_description: 'Too many requests',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(500, 'Internal Server Error')

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(503, 'Service Unavailable')

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(400, 'Bad Request - plain text')

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(200, validTokenResponse)

		const result = await refreshAuthToken(baseParams)
		expect(result.access_token).toBe('test-access-token')
		expect(result.refresh_token).toBe('test-refresh-token')
	})

	it('throws McpError with upstream status for 400 (expired refresh token)', async () => {
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				400,
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'The refresh token has expired',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				401,
				JSON.stringify({
					error: 'invalid_client',
					error_description: 'Bad client credentials',
				})
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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(500, 'Server Error')

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(400, JSON.stringify({ error: 'some_unknown_error' }))

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
		fetchMock
			.get('https://dash.cloudflare.com')
			.intercept({ path: '/oauth2/token', method: 'POST' })
			.reply(
				400,
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'Internal: token xyz expired at 2024-01-01',
				})
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
