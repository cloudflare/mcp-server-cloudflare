import { describe, expect, it, vi } from 'vitest'

import { getAccountId, handleListRequest, normalizeLegacyResponse } from './proxy.js'

describe('legacy stdio compatibility proxy', () => {
	it('unwraps legacy toolResult responses', () => {
		const text = JSON.stringify([{ id: 'zone-1', name: 'example.com' }])
		const response = normalizeLegacyResponse({
			jsonrpc: '2.0',
			id: 1,
			result: {
				toolResult: { content: [{ type: 'text', text }] },
				errorMessage: undefined,
			},
		})

		expect(response).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: { content: [{ type: 'text', text }] },
		})
	})

	it('removes non-standard metadata from direct tool results', () => {
		const response = normalizeLegacyResponse({
			jsonrpc: '2.0',
			id: 2,
			result: {
				content: [{ type: 'text', text: '[{"id":"worker-1"}]' }],
				metadata: {},
			},
		})

		expect(response.result).toEqual({
			content: [{ type: 'text', text: '[{"id":"worker-1"}]' }],
		})
	})

	it.each([
		[
			'zones_list',
			'https://api.cloudflare.com/client/v4/zones?account.id=account%2Fid&per_page=50',
		],
		['domain_list', 'https://api.cloudflare.com/client/v4/accounts/account%2Fid/workers/domains'],
		['worker_list', 'https://api.cloudflare.com/client/v4/accounts/account%2Fid/workers/scripts'],
	])('returns JSON text directly for %s', async (toolName, expectedUrl) => {
		const result = [{ id: `${toolName}-result` }]
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({ success: true, result }),
		})

		const response = await handleListRequest(
			{
				jsonrpc: '2.0',
				id: 3,
				method: 'tools/call',
				params: { name: toolName, arguments: {} },
			},
			{ accountId: 'account/id', apiToken: 'token', fetchImpl }
		)

		expect(fetchImpl).toHaveBeenCalledWith(expectedUrl, {
			headers: { Authorization: 'Bearer token' },
		})
		expect(response).toEqual({
			jsonrpc: '2.0',
			id: 3,
			result: {
				content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
			},
		})
		expect(JSON.parse(response.result.content[0].text)).toEqual(result)
	})

	it('returns API failures as standard MCP tool errors', async () => {
		const response = await handleListRequest(
			{
				jsonrpc: '2.0',
				id: 4,
				method: 'tools/call',
				params: { name: 'worker_list', arguments: {} },
			},
			{
				accountId: 'account-id',
				apiToken: 'token',
				fetchImpl: vi.fn().mockResolvedValue({
					ok: false,
					status: 403,
					json: vi.fn().mockResolvedValue({
						success: false,
						errors: [{ message: 'Forbidden' }],
					}),
				}),
			}
		)

		expect(response.result).toEqual({
			content: [{ type: 'text', text: 'Error: Forbidden' }],
			isError: true,
		})
	})

	it('delegates unrelated tools and calls without API-token credentials', async () => {
		const request = {
			jsonrpc: '2.0',
			id: 5,
			method: 'tools/call',
			params: { name: 'kv_namespaces_list', arguments: {} },
		}

		expect(await handleListRequest(request, { accountId: 'account-id', apiToken: 'token' })).toBe(
			undefined
		)
		expect(
			await handleListRequest(
				{ ...request, params: { name: 'zones_list', arguments: {} } },
				{ accountId: 'account-id', apiToken: undefined }
			)
		).toBe(undefined)
	})

	it('resolves the account ID from CLI arguments before the environment', () => {
		expect(
			getAccountId(['run', 'argument-account'], { CLOUDFLARE_ACCOUNT_ID: 'env-account' })
		).toBe('argument-account')
		expect(getAccountId(['run'], { CLOUDFLARE_ACCOUNT_ID: 'env-account' })).toBe('env-account')
	})
})
