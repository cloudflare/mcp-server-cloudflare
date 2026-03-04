import { fetchMock } from 'cloudflare:test'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { fetchCloudflareApi } from './cloudflare-api'
import { McpError } from './mcp-error'

// Mock cloudflare:workers env to disable DEV_DISABLE_OAUTH
vi.mock('cloudflare:workers', () => ({
	env: { DEV_DISABLE_OAUTH: false },
}))

beforeAll(() => {
	fetchMock.activate()
	fetchMock.disableNetConnect()
})

describe('fetchCloudflareApi', () => {
	const baseParams = {
		endpoint: '/workers/scripts',
		accountId: 'test-account-id',
		apiToken: 'test-api-token',
	}

	it('returns parsed data on success', async () => {
		const responseData = { result: { id: 'test-script' } }
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(200, responseData)

		const result = await fetchCloudflareApi(baseParams)
		expect(result).toEqual(responseData)
	})

	it('throws McpError with status 404 for not found', async () => {
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(404, JSON.stringify({ errors: [{ message: 'Script not found' }] }))

		try {
			await fetchCloudflareApi(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(404)
			expect(err.reportToSentry).toBe(false)
			expect(err.message).toBe('Cloudflare API request failed')
			expect(err.internalMessage).toContain('Script not found')
		}
	})

	it('throws McpError with status 403 for forbidden', async () => {
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(403, JSON.stringify({ errors: [{ message: 'Forbidden' }] }))

		try {
			await fetchCloudflareApi(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(403)
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError with status 429 for rate limiting', async () => {
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(429, JSON.stringify({ errors: [{ message: 'Rate limited' }] }))

		try {
			await fetchCloudflareApi(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(429)
			expect(err.reportToSentry).toBe(false)
		}
	})

	it('throws McpError with status 502 for upstream 500 (bad gateway)', async () => {
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
			const err = e as McpError
			expect(err.code).toBe(502)
			expect(err.message).toBe('Upstream Cloudflare API unavailable')
			expect(err.reportToSentry).toBe(true)
			expect(err.internalMessage).toContain('Cloudflare API 500')
		}
	})

	it('throws McpError with status 502 for upstream 502', async () => {
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(502, 'Bad Gateway')

		try {
			await fetchCloudflareApi(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(502)
			expect(err.message).toBe('Upstream Cloudflare API unavailable')
			expect(err.reportToSentry).toBe(true)
			expect(err.internalMessage).toContain('Cloudflare API 502')
		}
	})

	it('preserves error text in internalMessage (not user-facing message)', async () => {
		const errorBody = '{"errors":[{"message":"Worker not found","code":10007}]}'
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({
				path: '/client/v4/accounts/test-account-id/workers/scripts',
				method: 'GET',
			})
			.reply(404, errorBody)

		try {
			await fetchCloudflareApi(baseParams)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.message).toBe('Cloudflare API request failed')
			expect(err.internalMessage).toContain('Worker not found')
		}
	})
})
