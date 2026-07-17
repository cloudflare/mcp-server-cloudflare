import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRestR2Storage } from './r2'

const creds = { accountId: 'account-id', apiToken: 'token' }

function response(body: BodyInit | null, init: ResponseInit = {}): Response {
	return new Response(body, init)
}

describe('createRestR2Storage', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it.each(['../secret', '../../other-bucket/objects/secret', '/absolute', 'memory//note.md'])(
		'rejects unsafe object path %s before issuing a request',
		async (path) => {
			const fetchMock = vi.fn()
			vi.stubGlobal('fetch', fetchMock)
			const storage = createRestR2Storage(creds, 'agent-memory-mcp')

			await expect(storage.read(path)).rejects.toThrow(/invalid memory path/i)
			expect(fetchMock).not.toHaveBeenCalled()
		}
	)

	it('rejects an absolute list prefix before issuing a request', async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		const storage = createRestR2Storage(creds, 'agent-memory-mcp')

		await expect(storage.list('/')).rejects.toThrow(/relative path/i)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('encodes safe path segments without escaping the configured bucket', async () => {
		const fetchMock = vi.fn().mockResolvedValue(response('hello'))
		vi.stubGlobal('fetch', fetchMock)
		const storage = createRestR2Storage(creds, 'agent-memory-mcp')

		await storage.read('memory/a note.md')

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.cloudflare.com/client/v4/accounts/account-id/r2/buckets/agent-memory-mcp/objects/memory/a%20note.md',
			expect.any(Object)
		)
	})

	it('refuses an unbounded paginated listing', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			response(
				JSON.stringify({
					success: true,
					result: [],
					result_info: { is_truncated: true, cursor: 'next' },
				}),
				{ headers: { 'content-type': 'application/json' } }
			)
		)
		vi.stubGlobal('fetch', fetchMock)
		const storage = createRestR2Storage(creds, 'agent-memory-mcp')

		await expect(storage.list('', true)).rejects.toThrow(/choose a narrower path/i)
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('creates a missing bucket once, then retries parallel writes', async () => {
		let putCalls = 0
		let createCalls = 0
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input)
			if (init?.method === 'PUT') {
				putCalls++
				if (putCalls <= 2) return response('missing', { status: 404 })
				return response(JSON.stringify({ result: { version: `v-${putCalls}` } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				})
			}
			if (url.endsWith('/r2/buckets') && init?.method === 'POST') {
				createCalls++
				return response('{}', { status: 200 })
			}
			throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`)
		})
		vi.stubGlobal('fetch', fetchMock)
		const storage = createRestR2Storage(creds, 'agent-memory-mcp')

		await Promise.all([storage.write('a.md', 'a'), storage.write('b.md', 'b')])

		expect(createCalls).toBe(1)
		expect(putCalls).toBe(4)
	})
})
