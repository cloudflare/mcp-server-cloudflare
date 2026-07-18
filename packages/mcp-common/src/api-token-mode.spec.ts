import { describe, expect, it, vi } from 'vitest'

import { handleApiTokenMode, isApiTokenRequest } from './api-token-mode'

const env = {
	DEV_CLOUDFLARE_API_TOKEN: '',
	DEV_CLOUDFLARE_EMAIL: '',
	DEV_DISABLE_OAUTH: '',
}

function requestWithAuth(authHeader?: string): Request {
	const headers = new Headers()
	if (authHeader !== undefined) headers.set('Authorization', authHeader)
	return new Request('https://example.com/mcp', { headers })
}

describe('isApiTokenRequest', () => {
	it('does not throw for an empty bearer header', async () => {
		await expect(isApiTokenRequest(requestWithAuth('Bearer'), env)).resolves.toBe(false)
		await expect(isApiTokenRequest(requestWithAuth('Bearer '), env)).resolves.toBe(false)
	})

	it('identifies non-OAuth bearer tokens as API token requests', async () => {
		await expect(isApiTokenRequest(requestWithAuth('Bearer direct-api-token'), env)).resolves.toBe(
			true
		)
	})

	it('does not treat provider-issued OAuth tokens as API tokens', async () => {
		await expect(isApiTokenRequest(requestWithAuth('Bearer user:grant:secret'), env)).resolves.toBe(
			false
		)
	})
})

describe('handleApiTokenMode', () => {
	it('returns 401 when bearer token is missing instead of throwing', async () => {
		const agent = {
			serve: vi.fn(),
		}

		const response = await handleApiTokenMode(
			agent as never,
			requestWithAuth('Bearer '),
			env,
			{} as ExecutionContext
		)

		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({ error: 'Bearer token required' })
		expect(agent.serve).not.toHaveBeenCalled()
	})
})
