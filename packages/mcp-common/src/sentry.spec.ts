import { fetchMock } from 'cloudflare:test'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Mock the cloudflare SDK to avoid node:fs ReadStream import in workerd
vi.mock('cloudflare', () => ({
	Cloudflare: vi.fn(),
	APIError: class APIError extends Error {
		status: number
		constructor(status: number, message: string) {
			super(message)
			this.status = status
		}
	},
}))

import { fetchCloudflareApi } from './cloudflare-api'
import { getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'

beforeAll(() => {
	fetchMock.activate()
	fetchMock.disableNetConnect()
})

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
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					path: '/client/v4/accounts/test-account-id/workers/scripts',
					method: 'GET',
				})
				.reply(404, JSON.stringify({ errors: [{ message: 'Not found' }] }))

			try {
				await fetchCloudflareApi(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 5xx errors', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					path: '/client/v4/accounts/test-account-id/workers/scripts',
					method: 'GET',
				})
				.reply(500, 'Internal Server Error')

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
			fetchMock
				.get('https://dash.cloudflare.com')
				.intercept({ path: '/oauth2/token', method: 'POST' })
				.reply(400, JSON.stringify({ error: 'invalid_grant' }))

			try {
				await getAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 502 (upstream 500)', async () => {
			fetchMock
				.get('https://dash.cloudflare.com')
				.intercept({ path: '/oauth2/token', method: 'POST' })
				.reply(500, 'Internal Server Error')

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
			fetchMock
				.get('https://dash.cloudflare.com')
				.intercept({ path: '/oauth2/token', method: 'POST' })
				.reply(400, JSON.stringify({ error: 'invalid_grant' }))

			try {
				await refreshAuthToken(baseParams)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				expect((e as McpError).reportToSentry).toBe(false)
			}
		})

		it('sets reportToSentry=true for 502 (upstream 500)', async () => {
			fetchMock
				.get('https://dash.cloudflare.com')
				.intercept({ path: '/oauth2/token', method: 'POST' })
				.reply(500, 'Server Error')

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
