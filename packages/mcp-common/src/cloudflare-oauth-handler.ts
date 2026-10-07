import {
	AuthorizationError,
	authorizationErrorRedirect,
	CimdFetchError,
	GrantType,
	OAuthError as ProviderOAuthError,
} from '@cloudflare/workers-oauth-provider'
import { Hono } from 'hono'

import { AuthUser } from '@repo/mcp-observability'

import { AuthPropsSchema, CloudflareAccountsSchema, CloudflareUserSchema } from './auth-props'
import {
	generatePKCECodes,
	getAuthorizationURL,
	getAuthToken,
	refreshAuthToken,
} from './cloudflare-auth'
import { McpError, safeStatusCode } from './mcp-error'
import { useSentry } from './sentry'
import { cloudflareFetch } from './user-agent'
import { V4Schema } from './v4-api'
import {
	consentApprovalSecret,
	OAuthError,
	parseRedirectApproval,
	renderApprovalDialog,
} from './workers-oauth-utils'

import type {
	AuthRequest,
	OAuthHelpers,
	TokenExchangeCallbackOptions,
	TokenExchangeCallbackResult,
} from '@cloudflare/workers-oauth-provider'
import type { Context } from 'hono'
import type { z } from 'zod'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { AuthProps } from './auth-props'
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
	return new OAuthError(oauthCode, e.message, e.code >= 500 ? 500 : e.code, e.headers).toResponse()
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

type UserSchema = z.infer<typeof CloudflareUserSchema>
type AccountsSchema = z.infer<typeof CloudflareAccountsSchema>

export { AuthPropsSchema }
export type { AuthProps } from './auth-props'

function retryAfterHeaders(...responses: Response[]): Record<string, string> {
	return {
		'Retry-After':
			responses.find((response) => response.status === 429)?.headers.get('Retry-After') ?? '30',
	}
}

/** Classifies one or more identity-probe failures by priority. */
function throwIdentityProbeError(
	statuses: readonly [number, ...number[]],
	internalMessage: string,
	headers: Record<string, string> = {}
): never {
	if (statuses.some((status) => status >= 500)) {
		throw new McpError('Cloudflare API is temporarily unavailable', 502, {
			reportToSentry: true,
			internalMessage,
		})
	}
	if (statuses.includes(429)) {
		throw new McpError('Rate limited, try again later', 429, {
			reportToSentry: false,
			internalMessage,
			headers,
		})
	}
	if (statuses.includes(401)) {
		throw new McpError('Access token is invalid or expired', 401, {
			reportToSentry: false,
			internalMessage,
		})
	}
	if (statuses.includes(403)) {
		throw new McpError('Token lacks required user:read or account:read scope', 403, {
			reportToSentry: false,
			internalMessage,
		})
	}
	if (statuses.includes(400)) {
		throw new McpError('Access token appears malformed; reauthenticate and try again', 401, {
			reportToSentry: false,
			internalMessage,
		})
	}
	throw new McpError('Failed to verify token', safeStatusCode(statuses[0]), {
		reportToSentry: false,
		internalMessage,
	})
}

function throwCombinedApiError(userResponse: Response, accountsResponse: Response): never {
	throwIdentityProbeError(
		[userResponse.status, accountsResponse.status],
		`Upstream user=${userResponse.status}, accounts=${accountsResponse.status}`,
		retryAfterHeaders(userResponse, accountsResponse)
	)
}

export type CloudflareTokenOwner = 'account' | 'unknown' | 'user'

export interface VerifiedIdentity {
	user: UserSchema | null
	accounts: AccountsSchema
	/**
	 * True when an ok-status probe returned an unparseable payload and the
	 * identity was filled in with less information than the credential has.
	 * Degraded identities may serve the current request but must never be
	 * cached: they would pin the data loss until the cache entry expires.
	 */
	degraded: boolean
}

export async function getUserAndAccounts(
	accessToken: string,
	devModeHeaders?: HeadersInit,
	tokenOwner: CloudflareTokenOwner = 'unknown'
): Promise<VerifiedIdentity> {
	const headers = devModeHeaders
		? devModeHeaders
		: {
				Authorization: `Bearer ${accessToken}`,
			}

	// Account-owned tokens cannot represent a user, so skip the unnecessary user probe.
	let userResponse: Response | undefined
	let accountsResponse: Response
	try {
		const userRequest =
			tokenOwner === 'account'
				? Promise.resolve(undefined)
				: cloudflareFetch('https://api.cloudflare.com/client/v4/user', { headers })
		;[userResponse, accountsResponse] = await Promise.all([
			userRequest,
			cloudflareFetch('https://api.cloudflare.com/client/v4/accounts', { headers }),
		])
	} catch (error) {
		console.error('Cloudflare API request failed', error)
		throw new McpError('Cloudflare API is temporarily unavailable', 502, {
			reportToSentry: true,
			internalMessage: `Network error: ${error instanceof Error ? error.message : String(error)}`,
		})
	}

	if (userResponse === undefined && !accountsResponse.ok) {
		const message = `Cloudflare API error: accounts=${accountsResponse.status}`
		if (accountsResponse.status >= 500) {
			console.error(message)
		} else {
			console.warn(message)
		}
		throwIdentityProbeError(
			[accountsResponse.status],
			`Upstream accounts=${accountsResponse.status}`,
			retryAfterHeaders(accountsResponse)
		)
	}

	// If both endpoints failed, use priority-based error classification
	if (userResponse !== undefined && !userResponse.ok && !accountsResponse.ok) {
		const message = `Cloudflare API error: user=${userResponse.status}, accounts=${accountsResponse.status}`
		if (userResponse.status >= 500 || accountsResponse.status >= 500) {
			console.error(message)
		} else {
			console.warn(message)
		}
		throwCombinedApiError(userResponse, accountsResponse)
	}

	// Parse accounts with safeParse for graceful degradation
	let degraded = false
	let accounts: AccountsSchema = []
	if (accountsResponse.ok) {
		try {
			const json = await accountsResponse.json()
			const parsed = V4Schema(CloudflareAccountsSchema).safeParse(json)
			if (parsed.success) {
				accounts = parsed.data.result ?? []
			} else {
				degraded = true
				console.error('Cloudflare API /accounts payload did not match expected shape', parsed.error)
			}
		} catch (error) {
			degraded = true
			console.error('Cloudflare API /accounts response is not valid JSON', error)
		}
	} else if (userResponse?.ok) {
		// User succeeded but accounts failed — surface the accounts error
		// (5xx should be reported, 4xx like 403 may indicate insufficient scopes)
		const message = `Cloudflare API /accounts failed with status ${accountsResponse.status}`
		if (accountsResponse.status >= 500) {
			console.error(message)
		} else {
			console.warn(message)
		}
		throwIdentityProbeError(
			[accountsResponse.status],
			`Upstream accounts=${accountsResponse.status}`,
			retryAfterHeaders(accountsResponse)
		)
	}

	if (userResponse === undefined) {
		if (accounts.length === 1) return { user: null, accounts, degraded }
		throw new McpError('Account token must resolve to exactly one Cloudflare account', 401, {
			reportToSentry: false,
			internalMessage: `accounts=${accountsResponse.status}, count=${accounts.length}`,
		})
	}

	// Parse user with safeParse for graceful degradation
	let user: UserSchema | null = null
	if (userResponse.ok) {
		try {
			const json = await userResponse.json()
			const parsed = V4Schema(CloudflareUserSchema).safeParse(json)
			if (parsed.success) {
				user = parsed.data.result ?? null
			} else {
				degraded = true
				console.error('Cloudflare API /user payload did not match expected shape', parsed.error)
			}
		} catch (error) {
			degraded = true
			console.error('Cloudflare API /user response is not valid JSON', error)
		}
	} else if (accounts.length > 0 && tokenOwner === 'unknown' && userResponse.status < 429) {
		// Only legacy credentials need response-based account-token inference.
		// Transient failures must never change the inferred credential owner.
		return { user: null, accounts, degraded }
	} else {
		throwIdentityProbeError(
			[userResponse.status],
			`Upstream user=${userResponse.status}`,
			retryAfterHeaders(userResponse)
		)
	}

	if (user) {
		return { user, accounts, degraded }
	}

	// Only legacy unprefixed tokens need response-based account-token inference.
	if (accounts.length > 0 && tokenOwner === 'unknown') {
		return { user: null, accounts, degraded }
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

	// Cloudflare OAuth authorization-code grants always represent a user principal.
	const { user, accounts } = await getUserAndAccounts(accessToken, undefined, 'user')
	// User cannot be null for OAuth flow
	if (user === null) {
		throw new McpError('Failed to fetch user', 500, { reportToSentry: true })
	}

	return { accessToken, refreshToken, user, accounts }
}

export async function handleTokenExchangeCallback(
	options: TokenExchangeCallbackOptions,
	clientId: string,
	clientSecret: string
): Promise<TokenExchangeCallbackResult | undefined> {
	// options.props contains the current props
	if (options.grantType === GrantType.REFRESH_TOKEN) {
		const props = AuthPropsSchema.parse(options.props)
		if (props.type === 'account_token') {
			// Account tokens cannot be refreshed — this is a client error, not a server error
			throw new ProviderOAuthError('invalid_grant', {
				description: 'Account tokens cannot be refreshed',
				statusCode: 400,
			})
		}
		if (!props.refreshToken) {
			throw new ProviderOAuthError('invalid_grant', {
				description: 'No refresh token available for this grant',
				statusCode: 400,
			})
		}

		// handle token refreshes — convert upstream McpErrors to OAuth-compliant errors
		let accessToken: string
		let refreshToken: string
		let expires_in: number
		try {
			const result = await refreshAuthToken({
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: props.refreshToken,
			})
			accessToken = result.access_token
			refreshToken = result.refresh_token
			expires_in = result.expires_in
		} catch (e) {
			if (e instanceof McpError) {
				// Map upstream failures to OAuth error codes per RFC 6749
				let oauthCode: string
				let httpStatus: number
				if (e.code >= 500) {
					oauthCode = 'server_error'
					httpStatus = 500
				} else if (e.code === 429) {
					oauthCode = 'temporarily_unavailable'
					httpStatus = 503
				} else if (e.code === 401) {
					oauthCode = 'invalid_client'
					httpStatus = 401
				} else {
					oauthCode = 'invalid_grant'
					httpStatus = 400
				}
				throw new ProviderOAuthError(oauthCode, {
					description: e.message,
					statusCode: httpStatus,
				})
			}
			throw e
		}

		return {
			newProps: {
				...options.props,
				accessToken,
				refreshToken,
			} satisfies AuthProps,
			accessTokenTTL: expires_in,
		}
	}
}

/**
 * Saves the approved request with a fresh PKCE verifier (`beginUpstream()`, bound to this browser)
 * and redirects to Cloudflare's authorization screen with the resulting opaque `state`.
 * Call only after consent: approved now, or remembered.
 */
async function redirectToCloudflare(
	c: Context<AuthContext>,
	approvedRequest: AuthRequest,
	scopes: Record<string, string>,
	headers?: Headers
): Promise<Response> {
	const { codeChallenge, codeVerifier } = await generatePKCECodes()
	const upstream = await c.env.OAUTH_PROVIDER.beginUpstream(approvedRequest, {
		data: { codeVerifier } satisfies UpstreamData,
		headers,
	})
	const { authUrl } = await getAuthorizationURL({
		client_id: c.env.CLOUDFLARE_CLIENT_ID,
		redirect_uri: new URL('/oauth/callback', c.req.url).href,
		state: upstream.state,
		scopes,
		codeChallenge,
	})
	upstream.headers.set('Location', authUrl)
	return new Response(null, { status: 302, headers: upstream.headers })
}

/** What `beginUpstream()` keeps server-side for the callback. */
type UpstreamData = { codeVerifier: string }

/** Remembered consent belongs to the browser: the user is known only after Cloudflare sign-in. */
async function rememberConsent(c: Context<AuthContext>) {
	return { secret: await consentApprovalSecret(c.env.MCP_COOKIE_ENCRYPTION_KEY) }
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
			let oauthReqInfo: AuthRequest
			try {
				oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)
			} catch (e) {
				// Expected request-validation failures: redirect when the provider has
				// already validated the client's redirect URI, render locally otherwise.
				if (e instanceof AuthorizationError) {
					if (!e.redirectUri) {
						return new OAuthError(e.code, e.description, 400).toResponse()
					}
					const redirect = new URL(e.redirectUri)
					redirect.searchParams.set('error', e.code)
					redirect.searchParams.set('error_description', e.description)
					if (e.state) redirect.searchParams.set('state', e.state)
					if (e.issuer) redirect.searchParams.set('iss', e.issuer)
					return new Response(null, {
						status: 302,
						headers: { Location: redirect.href, 'Cache-Control': 'no-store' },
					})
				}
				throw e
			}
			oauthReqInfo.scope = Object.keys(scopes)

			// A client this browser already approved, for these scopes, skips the page.
			if (
				await c.env.OAUTH_PROVIDER.isConsentRemembered(
					c.req.raw,
					oauthReqInfo,
					await rememberConsent(c)
				)
			) {
				return redirectToCloudflare(c, oauthReqInfo, scopes)
			}

			// describeConsent() first: a failed client lookup leaves nothing in KV.
			const consentDescription = await c.env.OAUTH_PROVIDER.describeConsent(oauthReqInfo)
			// The request stays server-side; the page posts back only this browser-bound handle.
			const consent = await c.env.OAUTH_PROVIDER.beginConsent(oauthReqInfo)

			const response = renderApprovalDialog(c.req.raw, {
				consent: consentDescription,
				server: {
					name: c.env.MCP_SERVER_NAME || 'Cloudflare MCP Server',
					logo: 'https://images.mcp.cloudflare.com/mcp.svg',
					description:
						c.env.MCP_SERVER_DESCRIPTION || 'This server uses Cloudflare for authentication.',
				},
				handle: consent.handle,
				headers: consent.headers,
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
			if (e instanceof CimdFetchError) {
				return new OAuthError(
					'temporarily_unavailable',
					'Client metadata is temporarily unavailable. Please try again.',
					503,
					{ 'Retry-After': '30' }
				).toResponse()
			}
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
			const { handle, decision } = await parseRedirectApproval(c.req.raw)

			if (decision === 'deny') {
				// Back to the MCP client with access_denied, its state and iss.
				const denied = await c.env.OAUTH_PROVIDER.denyConsent(c.req.raw, handle)
				return new Response(null, { status: 302, headers: denied.headers })
			}

			// The request comes back from storage, not from the form.
			const approved = await c.env.OAUTH_PROVIDER.approveConsent(c.req.raw, handle, {
				remember: await rememberConsent(c),
			})
			return redirectToCloudflare(c, approved.request, scopes, approved.headers)
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
			// The consent page expired, was used, or was opened in another browser.
			if (e instanceof AuthorizationError) {
				return new OAuthError(e.code, e.description, 400).toResponse()
			}
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
	app.get(`/oauth/callback`, async (c) => {
		try {
			// Recover the approved request: single use, bound to this browser by its cookie.
			const {
				request: oauthReqInfo,
				data: { codeVerifier },
				headers,
			} = await c.env.OAUTH_PROVIDER.finishUpstream<UpstreamData>(c.req.raw)

			// The user declined (or sign-in failed) at Cloudflare: tell the MCP client.
			if (c.req.query('error')) {
				headers.set('Location', authorizationErrorRedirect(oauthReqInfo, 'access_denied'))
				return new Response(null, { status: 302, headers })
			}

			const code = c.req.query('code')
			if (!code) {
				return new OAuthError('invalid_request', 'Missing code', 400).toResponse()
			}

			// Exchange code for tokens and get user details, using the codeVerifier from KV.
			// MCP clients register themselves through the provider's /register endpoint;
			// the authorize flow only completes grants for clients that already exist.
			const { accessToken, refreshToken, user, accounts } = await getTokenAndUserDetails(
				c,
				code,
				codeVerifier
			)

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

			// Back to the MCP client, clearing the upstream binding cookie.
			headers.set('Location', redirectTo)
			return new Response(null, { status: 302, headers })
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
			// The sign-in expired, was used, or came back to another browser; or
			// completeAuthorization refused the request.
			if (e instanceof AuthorizationError) {
				return new OAuthError(e.code, e.description, 400).toResponse()
			}
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
