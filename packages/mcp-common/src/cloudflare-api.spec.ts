import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { fetchCloudflareApi } from './cloudflare-api'
import { McpError } from './mcp-error'
import { server } from './test/msw-server'

const ENDPOINT = 'https://api.cloudflare.com/client/v4/accounts/test-account-id/workers/scripts'

describe('fetchCloudflareApi', () => {
	const baseParams = {
		endpoint: '/workers/scripts',
		accountId: 'test-account-id',
		apiToken: 'test-api-token',
	}

	it('returns parsed data on success', async () => {
		const responseData = { result: { id: 'test-script' } }
		server.use(http.get(ENDPOINT, () => HttpResponse.json(responseData)))

		const result = await fetchCloudflareApi(baseParams)
		expect(result).toEqual(responseData)
	})

	it('throws McpError with status 404 for not found', async () => {
		server.use(
			http.get(ENDPOINT, () =>
				HttpResponse.text(JSON.stringify({ errors: [{ message: 'Script not found' }] }), {
					status: 404,
				})
			)
		)

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
		server.use(
			http.get(ENDPOINT, () =>
				HttpResponse.text(JSON.stringify({ errors: [{ message: 'Forbidden' }] }), { status: 403 })
			)
		)

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
		server.use(
			http.get(ENDPOINT, () =>
				HttpResponse.text(JSON.stringify({ errors: [{ message: 'Rate limited' }] }), {
					status: 429,
				})
			)
		)

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
		server.use(
			http.get(ENDPOINT, () => HttpResponse.text('Internal Server Error', { status: 500 }))
		)

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
		server.use(http.get(ENDPOINT, () => HttpResponse.text('Bad Gateway', { status: 502 })))

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
		server.use(http.get(ENDPOINT, () => HttpResponse.text(errorBody, { status: 404 })))

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
