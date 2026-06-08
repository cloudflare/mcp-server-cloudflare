import { GrantType } from '@cloudflare/workers-oauth-provider'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { AuthUser } from '../../mcp-observability/src'
import {
	generatePKCECodes,
	getAuthorizationURL,
	getAuthToken,
	refreshAuthToken,
} from './cloudflare-auth'
import { McpError, safeStatusCode, throwUpstreamApiError } from './mcp-error'
import { useSentry } from './sentry'
import { V4Schema } from './v4-api'
import {
	bindStateToSession,
	clientIdAlreadyApproved,
	createOAuthState,
	generateCSRFProtection,
	OAuthError,
	parseRedirectApproval,
	renderApprovalDialog,
	validateOAuthState,
} from './workers-oauth-utils'

import type {
	AuthRequest,
	OAuthHelpers,
	TokenExchangeCallbackOptions,
	TokenExchangeCallbackResult,
} from '@cloudflare/workers-oauth-provider'
import type { Context } from 'hono'
import type { MetricsTracker } from '../../mcp-observability/src'
import type { BaseHonoContext } from './sentry'

/**
 * Converts an McpError into an OAuth 2.1 spec-compliant JSON error response.
 *
 * Maps HTTP status codes to the standard OAuth error codes defined in
 * https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-3.2.4
 */
function mcpErrorToOAuthResponse(e: McpError): Response {
	let oauthCode: string
	if (e.code >= 500) {
		oauthCode = 'server_error'
	} else if (e.code === 429) {
		oauthCode = 'temporarily_unavailable'
	} else if (e.code === 401 || e.code === 403) {
		oauthCode = 'access_denied'
	} else {
		oauthCode = 'invalid_request'
	}
	return new OAuthError(oauthCode, e.message, e.code >= 500 ? 500 : e.code).toResponse()
}

const REFRESH_GUARD_PREFIX = 'oauth:refresh-guard'
const REFRESH_IN_FLIGHT_TTL_SECONDS = 60
const REFRESH_FAILURE_TTL_SECONDS = 3600
const refreshInFlight = new Map<string, Promise<TokenExchangeCallbackResult | undefined>>()

type RefreshGuardContext = {
	userId?: string
	clientId?: string
	getHelpers?: () => OAuthHelpers
}

type RefreshFailureKind = 'upstream_terminal' | 'cached_replay' | 'in_flight_collision'

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}

function refreshGuardKeys(refreshTokenHash: string): { inFlight: string; failure: string } {
	return {
		inFlight: `${REFRESH_GUARD_PREFIX}:${refreshTokenHash}:in-flight`,
		failure: `${REFRESH_GUARD_PREFIX}:${refreshTokenHash}:failure`,
	}
}

function isTerminalRefreshError(error: unknown): error is OAuthError {
	return (
		error instanceof OAuthError &&
		['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(error.code)
	)
}

function logRefreshTelemetry(event: {
	kind: RefreshFailureKind
	code: string
	refreshTokenHash: string
	userId?: string
	clientId?: string
	grantsRevoked?: number
}): void {
	console.warn(`[refresh-telemetry] ${JSON.stringify({ ...event, at: Date.now() })}`)
}

async function revokeGrantsForClient(
	helpers: OAuthHelpers,
	userId: string,
	clientId: string
): Promise<number> {
	let revoked = 0
	let cursor: string | undefined
	do {
		const page = await helpers.listUserGrants(userId, cursor ? { cursor } : undefined)
		for (const grant of page.items) {
			if (grant.clientId !== clientId) continue
			await helpers.revokeGrant(grant.id, userId)
			revoked++
		}
		cursor = page.cursor
	} while (cursor)
	return revoked
}

async function getCachedRefreshFailure(
	kv: KVNamespace,
	failureKey: string
): Promise<{ code?: string; description?: string } | null> {
	try {
		const failure = await kv.get(failureKey, { type: 'json' })
		if (!failure || typeof failure !== 'object') return null
		return failure as { code?: string; description?: string }
	} catch (error) {
		console.warn('Refresh guard: failed to read cached refresh failure', error)
		return null
	}
}

async function isRefreshInFlight(kv: KVNamespace, inFlightKey: string): Promise<boolean> {
	try {
		return Boolean(await kv.get(inFlightKey))
	} catch (error) {
		console.warn('Refresh guard: failed to read in-flight marker', error)
		return false
	}
}

async function markRefreshInFlight(kv: KVNamespace, inFlightKey: string): Promise<void> {
	try {
		await kv.put(inFlightKey, JSON.stringify({ startedAt: Date.now() }), {
			expirationTtl: REFRESH_IN_FLIGHT_TTL_SECONDS,
		})
	} catch (error) {
		console.warn('Refresh guard: failed to write in-flight marker', error)
	}
}

async function cacheRefreshFailure(
	kv: KVNamespace,
	failureKey: string,
	error: OAuthError
): Promise<void> {
	try {
		await kv.put(
			failureKey,
			JSON.stringify({
				code: error.code,
				description: 'Token refresh failed; reauthorization is required',
				failedAt: Date.now(),
			}),
			{ expirationTtl: REFRESH_FAILURE_TTL_SECONDS }
		)
	} catch (cacheError) {
		console.warn('Refresh guard: failed to cache terminal refresh failure', cacheError)
	}
}

async function clearRefreshInFlight(kv: KVNamespace, inFlightKey: string): Promise<void> {
	try {
		await kv.delete(inFlightKey)
	} catch (error) {
		console.warn('Refresh guard: failed to clear in-flight marker', error)
	}
}

export async function guardRefreshTokenExchange(
	kv: KVNamespace,
	refreshToken: string,
	refresh: () => Promise<TokenExchangeCallbackResult | undefined>,
	context: RefreshGuardContext = {}
): Promise<TokenExchangeCallbackResult | undefined> {
	const refreshTokenHash = await sha256Hex(refreshToken)
	const keys = refreshGuardKeys(refreshTokenHash)
	const existingRefresh = refreshInFlight.get(refreshTokenHash)
	if (existingRefresh) return existingRefresh

	const refreshPromise = (async () => {
		try {
			const cachedFailure = await getCachedRefreshFailure(kv, keys.failure)
			if (cachedFailure) {
				const code = cachedFailure.code || 'invalid_grant'
				logRefreshTelemetry({
					kind: 'cached_replay',
					code,
					refreshTokenHash,
					userId: context.userId,
					clientId: context.clientId,
				})
				throw new OAuthError(
					code,
					cachedFailure.description || 'Token refresh recently failed; reauthorization is required',
					400
				)
			}

			if (await isRefreshInFlight(kv, keys.inFlight)) {
				logRefreshTelemetry({
					kind: 'in_flight_collision',
					code: 'temporarily_unavailable',
					refreshTokenHash,
					userId: context.userId,
					clientId: context.clientId,
				})
				throw new OAuthError(
					'temporarily_unavailable',
					'Token refresh is already in progress; retry shortly',
					429,
					{ 'Retry-After': '30' }
				)
			}

			await markRefreshInFlight(kv, keys.inFlight)

			try {
				return await refresh()
			} catch (error) {
				if (isTerminalRefreshError(error)) {
					await cacheRefreshFailure(kv, keys.failure, error)

					let grantsRevoked = 0
					if (
						error.code === 'invalid_grant' &&
						context.userId &&
						context.clientId &&
						context.getHelpers
					) {
						try {
							grantsRevoked = await revokeGrantsForClient(
								context.getHelpers(),
								context.userId,
								context.clientId
							)
						} catch (revokeError) {
							console.warn('Refresh guard: failed to revoke grant after invalid_grant', revokeError)
						}
					}

					logRefreshTelemetry({
						kind: 'upstream_terminal',
						code: error.code,
						refreshTokenHash,
						userId: context.userId,
						clientId: context.clientId,
						grantsRevoked,
					})
				}
				throw error
			} finally {
				await clearRefreshInFlight(kv, keys.inFlight)
			}
		} finally {
			refreshInFlight.delete(refreshTokenHash)
		}
	})()

	refreshInFlight.set(refreshTokenHash, refreshPromise)
	return refreshPromise
}

type AuthContext = {
	Bindings: {
		OAUTH_PROVIDER: OAuthHelpers
		OAUTH_KV: KVNamespace
		MCP_COOKIE_ENCRYPTION_KEY: string
		CLOUDFLARE_CLIENT_ID: string
		CLOUDFLARE_CLIENT_SECRET: string
		MCP_SERVER_NAME?: string
		MCP_SERVER_DESCRIPTION?: string
	}
} & BaseHonoContext

const AuthQuery = z.object({
	code: z.string().describe('OAuth code from CF dash'),
	state: z.string().describe('Value of the OAuth state'),
	scope: z.string().describe('OAuth scopes granted'),
})

type UserSchema = z.infer<typeof UserSchema>
const UserSchema = z.object({
	id: z.string(),
	email: z.string(),
})
const AccountSchema = z.object({
	name: z.string(),
	id: z.string(),
})
type AccountsSchema = z.infer<typeof AccountsSchema>
const AccountsSchema = z.array(AccountSchema)

const AccountAuthProps = z.object({
	type: z.literal('account_token'),
	accessToken: z.string(),
	account: AccountSchema,
})
const UserAuthProps = z.object({
	type: z.literal('user_token'),
	accessToken: z.string(),
	user: UserSchema,
	accounts: AccountsSchema,
	refreshToken: z.string().optional(),
})
export type AuthProps = z.infer<typeof AuthProps>
const AuthProps = z.discriminatedUnion('type', [AccountAuthProps, UserAuthProps])

/**
 * Throws an McpError for combined /user + /accounts failures.
 * Uses priority-based classification matching cloudflare-mcp patterns.
 */
function throwCombinedApiError(userStatus: number, accountsStatus: number): never {
	const statuses = [userStatus, accountsStatus]

	if (statuses.some((s) => s >= 500)) {
		throw new McpError('Cloudflare API is temporarily unavailable', 502, {
			reportToSentry: true,
			internalMessage: `Upstream user=${userStatus}, accounts=${accountsStatus}`,
		})
	}

	if (statuses.includes(429)) {
		throw new McpError('Rate limited, try again later', 429, {
			reportToSentry: false,
			internalMessage: `Upstream user=${userStatus}, accounts=${accountsStatus}`,
		})
	}

	if (statuses.includes(401)) {
		throw new McpError('Access token is invalid or expired', 401, {
			reportToSentry: false,
			internalMessage: `Upstream user=${userStatus}, accounts=${accountsStatus}`,
		})
	}

	if (statuses.includes(403)) {
		throw new McpError('Insufficient permissions', 403, {
			reportToSentry: false,
			internalMessage: `Upstream user=${userStatus}, accounts=${accountsStatus}`,
		})
	}

	throw new McpError('Failed to verify token', safeStatusCode(userStatus), {
		reportToSentry: false,
		internalMessage: `Upstream user=${userStatus}, accounts=${accountsStatus}`,
	})
}

export async function getUserAndAccounts(
	accessToken: string,
	devModeHeaders?: HeadersInit
): Promise<{ user: UserSchema | null; accounts: AccountsSchema }> {
	const headers = devModeHeaders
		? devModeHeaders
		: {
				Authorization: `Bearer ${accessToken}`,
			}

	// Fetch the user & accounts info from Cloudflare in parallel
	let userResponse: Response
	let accountsResponse: Response
	try {
		;[userResponse, accountsResponse] = await Promise.all([
			fetch('https://api.cloudflare.com/client/v4/user', { headers }),
			fetch('https://api.cloudflare.com/client/v4/accounts', { headers }),
		])
	} catch (error) {
		console.error('Cloudflare API request failed', error)
		throw new McpError('Cloudflare API is temporarily unavailable', 502, {
			reportToSentry: true,
			internalMessage: `Network error: ${error instanceof Error ? error.message : String(error)}`,
		})
	}

	// If both endpoints failed, use priority-based error classification
	if (!userResponse.ok && !accountsResponse.ok) {
		console.error(
			`Cloudflare API error: user=${userResponse.status}, accounts=${accountsResponse.status}`
		)
		throwCombinedApiError(userResponse.status, accountsResponse.status)
	}

	// Parse accounts with safeParse for graceful degradation
	let accounts: AccountsSchema = []
	if (accountsResponse.ok) {
		try {
			const json = await accountsResponse.json()
			const parsed = V4Schema(AccountsSchema).safeParse(json)
			if (parsed.success) {
				accounts = parsed.data.result ?? []
			} else {
				console.error('Cloudflare API /accounts payload did not match expected shape', parsed.error)
			}
		} catch (error) {
			console.error('Cloudflare API /accounts response is not valid JSON', error)
		}
	} else if (userResponse.ok) {
		// User succeeded but accounts failed — surface the accounts error
		// (5xx should be reported, 4xx like 403 may indicate insufficient scopes)
		console.error(`Cloudflare API /accounts failed with status ${accountsResponse.status}`)
		throwUpstreamApiError(accountsResponse.status, 'Cloudflare API /accounts')
	}

	// Parse user with safeParse for graceful degradation
	let user: UserSchema | null = null
	if (userResponse.ok) {
		try {
			const json = await userResponse.json()
			const parsed = V4Schema(UserSchema).safeParse(json)
			if (parsed.success) {
				user = parsed.data.result ?? null
			} else {
				console.error('Cloudflare API /user payload did not match expected shape', parsed.error)
			}
		} catch (error) {
			console.error('Cloudflare API /user response is not valid JSON', error)
		}
	} else if (accounts.length > 0) {
		// User endpoint failed but accounts succeeded — account-scoped token
		return { user: null, accounts }
	} else {
		throwUpstreamApiError(userResponse.status, 'Cloudflare API /user')
	}

	if (user) {
		return { user, accounts }
	}

	// Account-scoped token — user is null but accounts are present
	if (accounts.length > 0) {
		return { user: null, accounts }
	}

	throw new McpError('Failed to verify token: no user or account information', 401, {
		reportToSentry: false,
		internalMessage: `user=${userResponse.status}, accounts=${accountsResponse.status}`,
	})
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens, then fetches user and account details.
 *
 * @param c - Hono context containing OAuth environment variables (client ID/secret)
 * @param code - OAuth authorization code received from the authorization server
 * @param code_verifier - PKCE code verifier used to validate the authorization request
 * @returns Promise resolving to an object containing access token, refresh token, user profile, and accounts
 */
async function getTokenAndUserDetails(
	c: Context<AuthContext>,
	code: string,
	code_verifier: string
): Promise<{
	accessToken: string
	refreshToken: string
	user: UserSchema
	accounts: AccountsSchema
}> {
	// Exchange the code for an access token
	const { access_token: accessToken, refresh_token: refreshToken } = await getAuthToken({
		client_id: c.env.CLOUDFLARE_CLIENT_ID,
		client_secret: c.env.CLOUDFLARE_CLIENT_SECRET,
		redirect_uri: new URL('/oauth/callback', c.req.url).href,
		code,
		code_verifier,
	})

	const { user, accounts } = await getUserAndAccounts(accessToken)
	// User cannot be null for OAuth flow
	if (user === null) {
		throw new McpError('Failed to fetch user', 500, { reportToSentry: true })
	}

	return { accessToken, refreshToken, user, accounts }
}

export async function handleTokenExchangeCallback(
	options: TokenExchangeCallbackOptions,
	clientId: string,
	clientSecret: string,
	kv?: KVNamespace,
	getHelpers?: () => OAuthHelpers
): Promise<TokenExchangeCallbackResult | undefined> {
	// options.props contains the current props
	if (options.grantType === GrantType.REFRESH_TOKEN) {
		const props = AuthProps.parse(options.props)
		if (props.type === 'account_token') {
			// Account tokens cannot be refreshed — this is a client error, not a server error
			throw new OAuthError('invalid_grant', 'Account tokens cannot be refreshed', 400)
		}
		if (!props.refreshToken) {
			throw new OAuthError('invalid_grant', 'No refresh token available for this grant', 400)
		}

		const upstreamRefreshToken = props.refreshToken
		const refresh = async (): Promise<TokenExchangeCallbackResult | undefined> => {
			try {
				const result = await refreshAuthToken({
					client_id: clientId,
					client_secret: clientSecret,
					refresh_token: upstreamRefreshToken,
				})

				return {
					newProps: {
						...options.props,
						accessToken: result.access_token,
						refreshToken: result.refresh_token,
					} satisfies AuthProps,
					accessTokenTTL: result.expires_in,
				}
			} catch (e) {
				if (e instanceof McpError) {
					// Map upstream failures to OAuth error codes per RFC 6749
					let oauthCode: string
					let httpStatus: number
					const headers: Record<string, string> = {}
					if (e.code >= 500) {
						oauthCode = 'server_error'
						httpStatus = 500
					} else if (e.code === 429) {
						oauthCode = 'temporarily_unavailable'
						httpStatus = 429
						headers['Retry-After'] = '30'
					} else if (e.code === 401) {
						oauthCode = 'invalid_client'
						httpStatus = 401
					} else {
						oauthCode = 'invalid_grant'
						httpStatus = 400
					}
					throw new OAuthError(oauthCode, e.message, httpStatus, headers)
				}
				throw e
			}
		}

		if (!kv) {
			return refresh()
		}

		return guardRefreshTokenExchange(kv, upstreamRefreshToken, refresh, {
			userId: options.userId,
			clientId: options.clientId,
			getHelpers,
		})
	}
}

/**
 * Helper function to redirect to Cloudflare OAuth
 *
 * Note: We pass the stateToken as a simple string in the URL.
 * The existing getAuthorizationURL function will wrap it with the oauthReqInfo
 * before base64-encoding.
 * On callback, we extract the stateToken, look up the original oauthReqInfo in KV.
 */
async function redirectToCloudflare(
	c: Context<AuthContext>,
	oauthReqInfo: AuthRequest,
	stateToken: string,
	codeChallenge: string,
	scopes: Record<string, string>,
	additionalHeaders: Record<string, string> = {}
): Promise<Response> {
	// Create a modified oauthReqInfo that includes our stateToken
	const stateWithToken: AuthRequest = {
		...oauthReqInfo,
		state: stateToken, // embed our KV state token
	}

	const { authUrl } = await getAuthorizationURL({
		client_id: c.env.CLOUDFLARE_CLIENT_ID,
		redirect_uri: new URL('/oauth/callback', c.req.url).href,
		state: stateWithToken,
		scopes,
		codeChallenge,
	})

	return new Response(null, {
		status: 302,
		headers: {
			...additionalHeaders,
			Location: authUrl,
		},
	})
}

/**
 * Creates a Hono app with OAuth routes for a specific Cloudflare worker
 *
 * @param scopes optional subset of scopes to request when handling authorization requests
 * @param metrics MetricsTracker which is used to track auth metrics
 * @returns a Hono app with configured OAuth routes
 */
export function createAuthHandlers({
	scopes,
	metrics,
}: {
	scopes: Record<string, string>
	metrics: MetricsTracker
}) {
	const app = new Hono<AuthContext>()
	app.use(useSentry)

	/**
	 * GET /oauth/authorize - Show consent dialog or redirect if approved
	 */
	app.get(`/oauth/authorize`, async (c) => {
		try {
			const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)
			oauthReqInfo.scope = Object.keys(scopes)

			if (!oauthReqInfo.clientId) {
				return new OAuthError('invalid_request', 'Missing client_id parameter', 400).toResponse()
			}

			// Check if client was previously approved (skip consent if so)
			if (
				await clientIdAlreadyApproved(
					c.req.raw,
					oauthReqInfo.clientId,
					c.env.MCP_COOKIE_ENCRYPTION_KEY
				)
			) {
				// Client already approved - create state and redirect immediately
				const { codeChallenge, codeVerifier } = await generatePKCECodes()
				const stateToken = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV, codeVerifier)
				const { setCookie: sessionCookie } = await bindStateToSession(stateToken)

				return redirectToCloudflare(c, oauthReqInfo, stateToken, codeChallenge, scopes, {
					'Set-Cookie': sessionCookie,
				})
			}

			// Client not approved - show consent dialog
			const { token: csrfToken, setCookie: csrfCookie } = generateCSRFProtection()

			// Render approval dialog
			const response = renderApprovalDialog(c.req.raw, {
				client: await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId),
				server: {
					name: c.env.MCP_SERVER_NAME || 'Cloudflare MCP Server',
					logo: 'https://images.mcp.cloudflare.com/mcp.svg',
					description:
						c.env.MCP_SERVER_DESCRIPTION || 'This server uses Cloudflare for authentication.',
				},
				state: {
					oauthReqInfo,
				},
				csrfToken,
				setCookie: csrfCookie,
			})

			return response
		} catch (e) {
			c.var.sentry?.recordError(e)
			let message: string | undefined
			if (e instanceof Error) {
				message = `${e.name}: ${e.message}`
			} else if (typeof e === 'string') {
				message = e
			} else {
				message = 'Unknown error'
			}
			metrics.logEvent(
				new AuthUser({
					errorMessage: `Authorize Error: ${message}`,
				})
			)
			if (e instanceof OAuthError) {
				return e.toResponse()
			}
			if (e instanceof McpError) {
				return mcpErrorToOAuthResponse(e)
			}
			console.error(e)
			return new OAuthError('server_error', 'Internal Error', 500).toResponse()
		}
	})

	/**
	 * POST /oauth/authorize - Handle consent form submission
	 */
	app.post(`/oauth/authorize`, async (c) => {
		try {
			// Validates CSRF token, extracts state, and generates approved client cookie
			const { state, headers } = await parseRedirectApproval(
				c.req.raw,
				c.env.MCP_COOKIE_ENCRYPTION_KEY
			)

			if (!state.oauthReqInfo) {
				return new OAuthError(
					'invalid_request',
					'Missing OAuth request info in state',
					400
				).toResponse()
			}

			const oauthReqInfo = state.oauthReqInfo as AuthRequest

			// Create OAuth state in KV and bind to session
			const { codeChallenge, codeVerifier } = await generatePKCECodes()
			const stateToken = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV, codeVerifier)
			const { setCookie: sessionCookie } = await bindStateToSession(stateToken)

			// Build redirect response
			const redirectResponse = await redirectToCloudflare(
				c,
				oauthReqInfo,
				stateToken,
				codeChallenge,
				scopes
			)

			// Add both cookies: approved client cookie (if present) and session binding cookie
			// Note: We must use append() for multiple Set-Cookie headers, not combine with commas
			if (headers['Set-Cookie']) {
				redirectResponse.headers.append('Set-Cookie', headers['Set-Cookie'])
			}
			redirectResponse.headers.append('Set-Cookie', sessionCookie)

			return redirectResponse
		} catch (e) {
			c.var.sentry?.recordError(e)
			let message: string | undefined
			if (e instanceof Error) {
				message = `${e.name}: ${e.message}`
			} else if (typeof e === 'string') {
				message = e
			} else {
				message = 'Unknown error'
			}
			metrics.logEvent(
				new AuthUser({
					errorMessage: `Authorize POST Error: ${message}`,
				})
			)
			if (e instanceof OAuthError) {
				return e.toResponse()
			}
			if (e instanceof McpError) {
				return mcpErrorToOAuthResponse(e)
			}
			console.error(e)
			return new OAuthError('server_error', 'Internal Error', 500).toResponse()
		}
	})

	/**
	 * GET /oauth/callback - Handle OAuth callback from Cloudflare
	 */
	app.get(`/oauth/callback`, zValidator('query', AuthQuery), async (c) => {
		try {
			const { code } = c.req.valid('query')

			// Validate state using dual validation (KV + session cookie)
			const { oauthReqInfo, codeVerifier, clearCookie } = await validateOAuthState(
				c.req.raw,
				c.env.OAUTH_KV
			)

			if (!oauthReqInfo.clientId) {
				return new OAuthError('invalid_request', 'Invalid OAuth request info', 400).toResponse()
			}

			// Exchange code for tokens and get user details
			const [{ accessToken, refreshToken, user, accounts }] = await Promise.all([
				getTokenAndUserDetails(c, code, codeVerifier), // use codeVerifier from KV
				c.env.OAUTH_PROVIDER.createClient({
					clientId: oauthReqInfo.clientId,
					tokenEndpointAuthMethod: 'none',
				}),
			])

			// Complete authorization and issue token to MCP client
			const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
				request: oauthReqInfo,
				userId: user.id,
				metadata: {
					label: user.email,
				},
				scope: oauthReqInfo.scope,
				props: {
					type: 'user_token',
					user,
					accounts,
					accessToken,
					refreshToken,
				} satisfies AuthProps,
			})

			metrics.logEvent(
				new AuthUser({
					userId: user.id,
				})
			)

			// Redirect back to MCP client with cleared session cookie
			return new Response(null, {
				status: 302,
				headers: {
					Location: redirectTo,
					'Set-Cookie': clearCookie,
				},
			})
		} catch (e) {
			c.var.sentry?.recordError(e)
			let message: string | undefined
			if (e instanceof Error) {
				console.error(e)
				message = `${e.name}: ${e.message}`
			} else if (typeof e === 'string') {
				message = e
			} else {
				message = 'Unknown error'
			}
			metrics.logEvent(
				new AuthUser({
					errorMessage: `Callback Error: ${message}`,
				})
			)
			if (e instanceof OAuthError) {
				return e.toResponse()
			}
			if (e instanceof McpError) {
				return mcpErrorToOAuthResponse(e)
			}
			return new OAuthError('server_error', 'Internal Error', 500).toResponse()
		}
	})

	return app
}
