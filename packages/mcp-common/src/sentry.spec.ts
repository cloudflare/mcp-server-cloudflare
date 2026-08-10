import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { fetchCloudflareApi } from './cloudflare-api'
import { getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'
import { server } from './test/msw-server'

/**
 * Tests that the actual production code sets reportToSentry correctly:
 * - 4xx upstream errors should have reportToSentry=false (expected client errors)
 * - 5xx upstream errors (mapped to 502) should have reportToSentry=true (unexpected)
 */
describe('reportToSentry flag in production code paths', () => {
	describe('fetchCloudflareApi', () => {
		const baseParams = {
			endpoint: '/workers/scripts',
			accountId: 'test-account-id',
			apiToken: 'test-api-token',
		}

		it('sets reportToSentry=false for 4xx errors', async () => {
			server.use(
				http.get(
					'https://api.cloudflare.com/client/v4/accounts/test-account-id/workers/scripts',
					() =>
						HttpResponse.text(JSON.stringify({ errors: [{ message: 'Not found' }] }), {
							status: 404,
						})
				)
			)

			try {
				await fetchCloudflareApi(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 5xx errors', async () => {
			server.use(
				http.get(
					'https://api.cloudflare.com/client/v4/accounts/test-account-id/workers/scripts',
					() => HttpResponse.text('Internal Server Error', { status: 500 })
				)
			)

			try {
				await fetchCloudflareApi(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(true)
			}
		})
	})

	describe('getAuthToken', () => {
		const baseParams = {
			client_id: 'test-client-id',
			client_secret: 'test-client-secret',
			redirect_uri: 'https://example.com/callback',
			code_verifier: 'test-verifier',
			code: 'test-code',
		}

		it('sets reportToSentry=false for 400 (invalid_grant)', async () => {
			server.use(
				http.post('https://dash.cloudflare.com/oauth2/token', () =>
					HttpResponse.text(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
				)
			)

			try {
				await getAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 502 (upstream 500)', async () => {
			server.use(
				http.post('https://dash.cloudflare.com/oauth2/token', () =>
					HttpResponse.text('Internal Server Error', { status: 500 })
				)
			)

			try {
				await getAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(true)
			}
		})
	})

	describe('refreshAuthToken', () => {
		const baseParams = {
			client_id: 'test-client-id',
			client_secret: 'test-client-secret',
			refresh_token: 'test-refresh-token',
		}

		it('sets reportToSentry=false for 400 (expired refresh token)', async () => {
			server.use(
				http.post('https://dash.cloudflare.com/oauth2/token', () =>
					HttpResponse.text(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
				)
			)

			try {
				await refreshAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 502 (upstream 500)', async () => {
			server.use(
				http.post('https://dash.cloudflare.com/oauth2/token', () =>
					HttpResponse.text('Server Error', { status: 500 })
				)
			)

			try {
				await refreshAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(true)
			}
		})
	})
})
