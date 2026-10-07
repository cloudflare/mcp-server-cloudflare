import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createWorkerDeployment,
	deleteWorkerDeployment,
	deleteWorkerScript,
	downloadWorkerScript,
	uploadWorkerScript,
	uploadWorkerVersion,
} from './workers-scripts.api'

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response())

function apiResponse(result: unknown) {
	return new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), {
		headers: { 'Content-Type': 'application/json' },
	})
}

beforeEach(() => {
	fetchMock.mockReset()
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('Workers Scripts API', () => {
	it('uploads a single-file version without setting a multipart boundary manually', async () => {
		fetchMock.mockResolvedValueOnce(
			apiResponse([
				{
					id: 'example-worker',
					bindings: [
						{ name: 'DATA', type: 'd1', database_id: 'database-1' },
						{ name: 'API_KEY', type: 'secret_text' },
					],
				},
			])
		)
		fetchMock.mockResolvedValueOnce(apiResponse({ id: 'version-1' }))

		await uploadWorkerVersion({
			accountId: 'account-1',
			apiToken: 'api-token',
			scriptName: 'example-worker',
			script: 'export default { fetch() { return new Response("ok") } }',
			compatibilityDate: '2025-03-10',
			compatibilityFlags: ['nodejs_compat'],
			message: 'staged update',
		})

		const [url, options] = fetchMock.mock.calls[1]
		expect(url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/account-1/workers/scripts/example-worker/versions?bindings_inherit=strict'
		)
		expect(options?.method).toBe('POST')
		expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer api-token')
		expect(new Headers(options?.headers).get('Content-Type')).toBeNull()
		const body = options?.body
		expect(body).toBeInstanceOf(FormData)
		if (!(body instanceof FormData)) throw new Error('Expected a multipart upload body')
		expect(JSON.parse(String(body.get('metadata')))).toEqual({
			main_module: 'worker.js',
			compatibility_date: '2025-03-10',
			compatibility_flags: ['nodejs_compat'],
			bindings: [
				{ type: 'inherit', name: 'DATA', version_id: 'latest' },
				{ type: 'inherit', name: 'API_KEY', version_id: 'latest' },
			],
			annotations: { 'workers/message': 'staged update' },
		})
		expect(body.has('worker.js')).toBe(true)
	})

	it('creates deployments with the documented percentage strategy', async () => {
		fetchMock.mockResolvedValueOnce(apiResponse({ id: 'deployment-1' }))

		await createWorkerDeployment({
			accountId: 'account-1',
			apiToken: 'api-token',
			scriptName: 'example-worker',
			versions: [{ version_id: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02', percentage: 100 }],
		})

		const [, options] = fetchMock.mock.calls[0]
		expect(options?.method).toBe('POST')
		expect(JSON.parse(String(options?.body))).toEqual({
			strategy: 'percentage',
			versions: [{ version_id: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02', percentage: 100 }],
		})
	})

	it('inherits existing bindings when immediately uploading a Worker script', async () => {
		fetchMock.mockResolvedValueOnce(
			apiResponse([
				{
					id: 'example-worker',
					compatibility_flags: ['nodejs_compat'],
					bindings: [{ name: 'KV', type: 'kv_namespace', namespace_id: 'namespace-1' }],
				},
			])
		)
		fetchMock.mockResolvedValueOnce(apiResponse({ id: 'example-worker' }))

		await uploadWorkerScript({
			accountId: 'account-1',
			apiToken: 'api-token',
			scriptName: 'example-worker',
			script: 'export default { fetch() {} }',
			compatibilityDate: '2025-03-10',
		})

		const [url, options] = fetchMock.mock.calls[1]
		expect(url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/account-1/workers/scripts/example-worker?bindings_inherit=strict'
		)
		expect(options?.method).toBe('PUT')
		const body = options?.body
		expect(body).toBeInstanceOf(FormData)
		if (!(body instanceof FormData)) throw new Error('Expected a multipart upload body')
		expect(JSON.parse(String(body.get('metadata')))).toMatchObject({
			compatibility_flags: ['nodejs_compat'],
			bindings: [{ type: 'inherit', name: 'KV', version_id: 'latest' }],
		})
	})

	it('handles the no-body response returned when deleting a Worker script', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

		await expect(
			deleteWorkerScript({
				accountId: 'account-1',
				apiToken: 'api-token',
				scriptName: 'example-worker',
			})
		).resolves.toBeUndefined()
	})

	it('accepts the deployment delete envelope that has no result property', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, errors: [], messages: [] }), {
				headers: { 'Content-Type': 'application/json' },
			})
		)

		await expect(
			deleteWorkerDeployment({
				accountId: 'account-1',
				apiToken: 'api-token',
				scriptName: 'example-worker',
				deploymentId: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02',
			})
		).resolves.toMatchObject({ success: true })
	})

	it('returns the raw script response with its content type', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('export default { fetch() {} }', {
				headers: { 'Content-Type': 'application/javascript' },
			})
		)

		await expect(
			downloadWorkerScript({
				accountId: 'account-1',
				apiToken: 'api-token',
				scriptName: 'example-worker',
			})
		).resolves.toEqual({
			contentType: 'application/javascript',
			content: 'export default { fetch() {} }',
		})
	})
})
