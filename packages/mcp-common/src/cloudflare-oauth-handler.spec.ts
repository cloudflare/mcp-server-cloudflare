import { fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshAuthToken } from './cloudflare-auth'
import { getUserAndAccounts, handleTokenExchangeCallback } from './cloudflare-oauth-handler'
import { McpError } from './mcp-error'
import { OAuthError } from './workers-oauth-utils'

import type { TokenExchangeCallbackOptions } from '@cloudflare/workers-oauth-provider'

// Mock the refreshAuthToken function
vi.mock('./cloudflare-auth', () => ({
	refreshAuthToken: vi.fn(),
	getAuthToken: vi.fn(),
	generatePKCECodes: vi.fn(),
	getAuthorizationURL: vi.fn(),
}))

const mockRefreshAuthToken = vi.mocked(refreshAuthToken)

beforeAll(() => {
	fetchMock.activate()
	fetchMock.disableNetConnect()
})

beforeEach(() => {
	vi.resetAllMocks()
})

afterEach(() => {
	vi.restoreAllMocks()
})

function makeRefreshOptions(propsOverride: Record<string, unknown>): TokenExchangeCallbackOptions {
	return {
		grantType: 'refresh_token',
		props: propsOverride,
		clientId: 'test',
		userId: 'test-user',
		scope: [],
	}
}

describe('handleTokenExchangeCallback', () => {
	const clientId = 'test-client-id'
	const clientSecret = 'test-client-secret'

	describe('account_token refresh attempt', () => {
		it('throws OAuthError invalid_grant for account token refresh', async () => {
			const options = makeRefreshOptions({
				type: 'account_token',
				accessToken: 'test-token',
				account: { name: 'test', id: 'test-id' },
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('invalid_grant')
				expect(err.statusCode).toBe(400)
				expect(err.description).toBe('Account tokens cannot be refreshed')
			}
		})
	})

	describe('missing refresh token', () => {
		it('throws OAuthError invalid_grant when refreshToken is missing', async () => {
			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
				// no refreshToken
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('invalid_grant')
				expect(err.statusCode).toBe(400)
				expect(err.description).toBe('No refresh token available for this grant')
			}
		})
	})

	describe('successful refresh', () => {
		it('returns new props and TTL on successful refresh', async () => {
			mockRefreshAuthToken.mockResolvedValueOnce({
				access_token: 'new-access-token',
				refresh_token: 'new-refresh-token',
				expires_in: 7200,
				scope: 'read write',
				token_type: 'bearer',
			})

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'old-access-token',
				refreshToken: 'old-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			const result = await handleTokenExchangeCallback(options, clientId, clientSecret)
			expect(result).toBeDefined()
			expect(result!.accessTokenTTL).toBe(7200)
			expect(result!.newProps).toMatchObject({
				accessToken: 'new-access-token',
				refreshToken: 'new-refresh-token',
			})
		})
	})

	describe('converts upstream McpErrors from refreshAuthToken to OAuthError', () => {
		it('converts McpError 400 from expired upstream refresh token to OAuthError invalid_grant', async () => {
			mockRefreshAuthToken.mockRejectedValueOnce(
				new McpError('Authorization grant is invalid, expired, or revoked', 400, {
					reportToSentry: false,
					internalMessage: 'Upstream 400: {"error":"invalid_grant"}',
				})
			)

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				refreshToken: 'expired-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('invalid_grant')
				expect(err.statusCode).toBe(400)
				expect(err.description).toBe('Authorization grant is invalid, expired, or revoked')
			}
		})

		it('converts McpError 502 from upstream server error to OAuthError server_error', async () => {
			mockRefreshAuthToken.mockRejectedValueOnce(
				new McpError('Upstream token service unavailable', 502, {
					reportToSentry: true,
					internalMessage: 'Upstream 500: Internal Server Error',
				})
			)

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				refreshToken: 'valid-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('server_error')
				expect(err.statusCode).toBe(500)
				expect(err.description).toBe('Upstream token service unavailable')
			}
		})

		it('converts McpError 429 to OAuthError temporarily_unavailable', async () => {
			mockRefreshAuthToken.mockRejectedValueOnce(
				new McpError('Rate limited, try again later', 429, {
					reportToSentry: false,
					internalMessage: 'Upstream 429',
				})
			)

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				refreshToken: 'valid-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('temporarily_unavailable')
				expect(err.statusCode).toBe(503)
			}
		})

		it('converts McpError 401 to OAuthError invalid_client', async () => {
			mockRefreshAuthToken.mockRejectedValueOnce(
				new McpError('Access token is invalid or expired', 401, {
					reportToSentry: false,
					internalMessage: 'Upstream 401',
				})
			)

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				refreshToken: 'valid-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(OAuthError)
				const err = e as OAuthError
				expect(err.code).toBe('invalid_client')
				expect(err.statusCode).toBe(401)
			}
		})

		it('re-throws non-McpError errors unchanged', async () => {
			const genericError = new Error('unexpected failure')
			mockRefreshAuthToken.mockRejectedValueOnce(genericError)

			const options = makeRefreshOptions({
				type: 'user_token',
				accessToken: 'test-token',
				refreshToken: 'valid-refresh-token',
				user: { id: 'user-1', email: 'user@example.com' },
				accounts: [{ name: 'test', id: 'test-id' }],
			})

			try {
				await handleTokenExchangeCallback(options, clientId, clientSecret)
				expect.unreachable()
			} catch (e) {
				expect(e).toBe(genericError)
				expect(e).not.toBeInstanceOf(OAuthError)
			}
		})
	})

	describe('non-refresh grant types', () => {
		it('returns undefined for authorization_code grant type', async () => {
			const options: TokenExchangeCallbackOptions = {
				grantType: 'authorization_code',
				props: {},
				clientId: 'test',
				userId: 'test-user',
				scope: [],
			}

			const result = await handleTokenExchangeCallback(options, clientId, clientSecret)
			expect(result).toBeUndefined()
		})
	})
})

function mockUserResponse(status: number, body?: unknown) {
	fetchMock
		.get('https://api.cloudflare.com')
		.intercept({ path: '/client/v4/user', method: 'GET' })
		.reply(status, body ? JSON.stringify(body) : '')
}

function mockAccountsResponse(status: number, body?: unknown) {
	fetchMock
		.get('https://api.cloudflare.com')
		.intercept({ path: '/client/v4/accounts', method: 'GET' })
		.reply(status, body ? JSON.stringify(body) : '')
}

const v4User = {
	success: true,
	result: { id: 'user-1', email: 'user@example.com' },
	errors: [],
	messages: [],
}
const v4Accounts = {
	success: true,
	result: [{ id: 'acc-1', name: 'My Account' }],
	errors: [],
	messages: [],
}

describe('getUserAndAccounts', () => {
	it('returns user and accounts on success', async () => {
		mockUserResponse(200, v4User)
		mockAccountsResponse(200, v4Accounts)

		const result = await getUserAndAccounts('test-token')
		expect(result.user).toEqual({ id: 'user-1', email: 'user@example.com' })
		expect(result.accounts).toEqual([{ id: 'acc-1', name: 'My Account' }])
	})

	it('returns user=null for account-scoped tokens (user 401, accounts 200)', async () => {
		mockUserResponse(401, { errors: [{ message: 'Unauthorized' }] })
		mockAccountsResponse(200, v4Accounts)

		const result = await getUserAndAccounts('test-token')
		expect(result.user).toBeNull()
		expect(result.accounts).toEqual([{ id: 'acc-1', name: 'My Account' }])
	})

	describe('combined failure (both endpoints fail)', () => {
		it('throws 502 when any endpoint returns 5xx', async () => {
			mockUserResponse(401)
			mockAccountsResponse(500)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(502)
				expect(err.reportToSentry).toBe(true)
			}
		})

		it('throws 429 when rate limited', async () => {
			mockUserResponse(429)
			mockAccountsResponse(429)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(429)
				expect(err.reportToSentry).toBe(false)
			}
		})

		it('throws 401 for expired token', async () => {
			mockUserResponse(401)
			mockAccountsResponse(401)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(401)
				expect(err.reportToSentry).toBe(false)
			}
		})

		it('throws 403 for insufficient permissions', async () => {
			mockUserResponse(403)
			mockAccountsResponse(403)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(403)
				expect(err.reportToSentry).toBe(false)
			}
		})
	})

	it('throws 401 when no user or account information is returned', async () => {
		mockUserResponse(200, { success: true, result: null, errors: [], messages: [] })
		mockAccountsResponse(200, { success: true, result: [], errors: [], messages: [] })

		try {
			await getUserAndAccounts('test-token')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(McpError)
			const err = e as McpError
			expect(err.code).toBe(401)
			expect(err.message).toBe('Failed to verify token: no user or account information')
		}
	})

	it('gracefully handles malformed JSON in /user response', async () => {
		fetchMock
			.get('https://api.cloudflare.com')
			.intercept({ path: '/client/v4/user', method: 'GET' })
			.reply(200, 'not json')
		mockAccountsResponse(200, v4Accounts)

		// Should still return accounts even if user parsing fails
		const result = await getUserAndAccounts('test-token')
		expect(result.user).toBeNull()
		expect(result.accounts).toEqual([{ id: 'acc-1', name: 'My Account' }])
	})

	describe('mixed-status priority in combined failures', () => {
		it('prioritizes 5xx over 429 (401+500 → 502)', async () => {
			mockUserResponse(401)
			mockAccountsResponse(500)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(502)
				expect(err.reportToSentry).toBe(true)
			}
		})

		it('prioritizes 429 over 401 (401+429 → 429)', async () => {
			mockUserResponse(401)
			mockAccountsResponse(429)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(429)
				expect(err.reportToSentry).toBe(false)
			}
		})

		it('prioritizes 5xx over 403 (403+500 → 502)', async () => {
			mockUserResponse(403)
			mockAccountsResponse(500)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(502)
				expect(err.reportToSentry).toBe(true)
			}
		})
	})

	describe('accounts failure with user success', () => {
		it('throws when accounts returns 500 even if user succeeds', async () => {
			mockUserResponse(200, v4User)
			mockAccountsResponse(500)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(502)
				expect(err.reportToSentry).toBe(true)
			}
		})

		it('throws when accounts returns 403 even if user succeeds', async () => {
			mockUserResponse(200, v4User)
			mockAccountsResponse(403)

			try {
				await getUserAndAccounts('test-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(403)
				expect(err.reportToSentry).toBe(false)
			}
		})
	})
})
