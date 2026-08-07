import {
	AuthorizationError,
	CimdFetchError,
	GrantType,
	OAuthError as ProviderOAuthError,
} from '@cloudflare/workers-oauth-provider'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshAuthToken } from './cloudflare-auth'
import {
	createAuthHandlers,
	getUserAndAccounts,
	handleTokenExchangeCallback,
} from './cloudflare-oauth-handler'
import { McpError } from './mcp-error'
import { server } from './test/msw-server'

import type { OAuthHelpers, TokenExchangeCallbackOptions } from '@cloudflare/workers-oauth-provider'
import type { MetricsTracker } from '@repo/mcp-observability'

// Mock the refreshAuthToken function
vi.mock('./cloudflare-auth', () => ({
	refreshAuthToken: vi.fn(),
	getAuthToken: vi.fn(),
	generatePKCECodes: vi.fn(),
	getAuthorizationURL: vi.fn(),
}))

const mockRefreshAuthToken = vi.mocked(refreshAuthToken)

beforeEach(() => {
	vi.resetAllMocks()
})

afterEach(() => {
	vi.restoreAllMocks()
})

function makeRefreshOptions(propsOverride: Record<string, unknown>): TokenExchangeCallbackOptions {
	return {
		grantType: GrantType.REFRESH_TOKEN,
		grantId: 'test-grant-id',
		props: propsOverride,
		clientId: 'test',
		userId: 'test-user',
		scope: [],
		requestedScope: [],
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).toBeInstanceOf(ProviderOAuthError)
				const err = e as ProviderOAuthError
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
				expect(e).not.toBeInstanceOf(ProviderOAuthError)
			}
		})
	})

	describe('non-refresh grant types', () => {
		it('returns undefined for authorization_code grant type', async () => {
			const options: TokenExchangeCallbackOptions = {
				grantType: GrantType.AUTHORIZATION_CODE,
				grantId: 'test-grant-id',
				props: {},
				clientId: 'test',
				userId: 'test-user',
				scope: [],
				requestedScope: [],
			}

			const result = await handleTokenExchangeCallback(options, clientId, clientSecret)
			expect(result).toBeUndefined()
		})
	})
})

function mockUserResponse(status: number, body?: unknown, headers?: HeadersInit) {
	server.use(
		http.get('https://api.cloudflare.com/client/v4/user', () =>
			HttpResponse.text(body ? JSON.stringify(body) : '', { status, headers })
		)
	)
}

function mockAccountsResponse(status: number, body?: unknown, headers?: HeadersInit) {
	server.use(
		http.get('https://api.cloudflare.com/client/v4/accounts', () =>
			HttpResponse.text(body ? JSON.stringify(body) : '', { status, headers })
		)
	)
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

	it('does not infer an account token when the caller knows the token is user-owned', async () => {
		mockUserResponse(401, { errors: [{ message: 'Unauthorized' }] })
		mockAccountsResponse(200, v4Accounts)

		await expect(getUserAndAccounts('test-token', undefined, 'user')).rejects.toMatchObject({
			code: 401,
		})
	})

	it('does not infer an account token when the user probe is rate limited', async () => {
		mockUserResponse(429, undefined, { 'Retry-After': '17' })
		mockAccountsResponse(200, v4Accounts)

		await expect(getUserAndAccounts('legacy-token')).rejects.toMatchObject({
			code: 429,
			headers: { 'Retry-After': '17' },
		})
	})

	it('returns a retryable 429 when the accounts probe is rate limited', async () => {
		mockUserResponse(200, v4User)
		mockAccountsResponse(429)

		await expect(getUserAndAccounts('test-token', undefined, 'user')).rejects.toMatchObject({
			code: 429,
			headers: { 'Retry-After': '30' },
		})
	})

	it('uses only the accounts probe and preserves 429 backoff for account tokens', async () => {
		let userCalls = 0
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () => {
				userCalls += 1
				return HttpResponse.json(v4User)
			})
		)
		mockAccountsResponse(429, undefined, { 'Retry-After': '23' })

		await expect(getUserAndAccounts('test-token', undefined, 'account')).rejects.toMatchObject({
			code: 429,
			headers: { 'Retry-After': '23' },
		})
		expect(userCalls).toBe(0)
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
				expect(err.message).toBe('Token lacks required user:read or account:read scope')
				expect(err.reportToSentry).toBe(false)
			}
		})

		it('maps malformed-token 400s to 401 invalid token', async () => {
			mockUserResponse(400)
			mockAccountsResponse(400)

			try {
				await getUserAndAccounts('malformed-token')
				expect.unreachable()
			} catch (e) {
				expect(e).toBeInstanceOf(McpError)
				const err = e as McpError
				expect(err.code).toBe(401)
				expect(err.message).toBe('Access token appears malformed; reauthenticate and try again')
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
		server.use(
			http.get('https://api.cloudflare.com/client/v4/user', () => HttpResponse.text('not json'))
		)
		mockAccountsResponse(200, v4Accounts)

		// Should still return accounts even if user parsing fails
		const result = await getUserAndAccounts('test-token')
		expect(result.user).toBeNull()
		expect(result.accounts).toEqual([{ id: 'acc-1', name: 'My Account' }])
	})

	describe('mixed-status priority in combined failures', () => {
		it('prioritizes 5xx over 429 (429+500 → 502)', async () => {
			mockUserResponse(429)
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

describe('createAuthHandlers authorize route', () => {
	const metrics = { logEvent() {} } as unknown as MetricsTracker
	const executionCtx = {
		props: {},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext

	function authorizeEnv(oauthProvider: Partial<OAuthHelpers>) {
		return {
			OAUTH_PROVIDER: oauthProvider as OAuthHelpers,
			OAUTH_KV: undefined as unknown as KVNamespace,
			MCP_COOKIE_ENCRYPTION_KEY: 'test-key',
			CLOUDFLARE_CLIENT_ID: 'client',
			CLOUDFLARE_CLIENT_SECRET: 'secret',
		}
	}

	it('redirects expected authorization failures to the validated client redirect URI', async () => {
		const app = createAuthHandlers({ scopes: {}, metrics })
		const response = await app.fetch(
			new Request('https://mcp.example.com/oauth/authorize?client_id=abc'),
			authorizeEnv({
				parseAuthRequest() {
					throw new AuthorizationError('invalid_scope', {
						description: 'Requested scope is not registered',
						redirectUri: 'https://client.example.com/callback',
						state: 'client-state',
						issuer: 'https://mcp.example.com',
					})
				},
			}),
			executionCtx
		)

		expect(response.status).toBe(302)
		const location = new URL(response.headers.get('location') ?? '')
		expect(`${location.origin}${location.pathname}`).toBe('https://client.example.com/callback')
		expect(location.searchParams.get('error')).toBe('invalid_scope')
		expect(location.searchParams.get('error_description')).toBe('Requested scope is not registered')
		expect(location.searchParams.get('state')).toBe('client-state')
		expect(location.searchParams.get('iss')).toBe('https://mcp.example.com')
		expect(response.headers.get('cache-control')).toBe('no-store')
	})

	it('renders locally when the failure precedes redirect URI validation', async () => {
		const app = createAuthHandlers({ scopes: {}, metrics })
		const response = await app.fetch(
			new Request('https://mcp.example.com/oauth/authorize'),
			authorizeEnv({
				parseAuthRequest() {
					throw new AuthorizationError('invalid_request', {
						description: 'client_id is required',
					})
				},
			}),
			executionCtx
		)

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toEqual({
			error: 'invalid_request',
			error_description: 'client_id is required',
		})
	})

	it('returns a retryable 503 when client metadata resolution fails', async () => {
		const clientId = 'https://client.example.com/metadata.json'
		const app = createAuthHandlers({ scopes: {}, metrics })
		const response = await app.fetch(
			new Request(`https://mcp.example.com/oauth/authorize?client_id=${clientId}`),
			authorizeEnv({
				async parseAuthRequest() {
					return { clientId } as Awaited<ReturnType<OAuthHelpers['parseAuthRequest']>>
				},
				async lookupClient() {
					throw new CimdFetchError(clientId, new Error('HTTP 403'))
				},
			}),
			executionCtx
		)

		expect(response.status).toBe(503)
		expect(response.headers.get('retry-after')).toBe('30')
		await expect(response.json()).resolves.toMatchObject({ error: 'temporarily_unavailable' })
	})
})
