import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { AuthUser } from '../../mcp-observability/src'
import { getAuthorizationURL, getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'
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

// AuthRequest but with extra params that we use in our authentication logic
const AuthRequestSchemaWithExtraParams = z.object({
	responseType: z.string(),
	clientId: z.string(),
	redirectUri: z.string(),
	scope: z.array(z.string()),
	state: z.string(),
	codeChallenge: z.string().optional(),
	codeChallengeMethod: z.string().optional(),
	codeVerifier: z.string(),
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

export async function getUserAndAccounts(
	accessToken: string,
	devModeHeaders?: HeadersInit
): Promise<{ user: UserSchema | null; accounts: AccountsSchema }> {
	const headers = devModeHeaders
		? devModeHeaders
		: {
				Authorization: `Bearer ${accessToken}`,
			}

	// Fetch the user & accounts info from Cloudflare
	const [userResponse, accountsResponse] = await Promise.all([
		fetch('https://api.cloudflare.com/client/v4/user', {
			headers,
		}),
		fetch('https://api.cloudflare.com/client/v4/accounts', {
			headers,
		}),
	])

	const { result: user } = V4Schema(UserSchema).parse(await userResponse.json())
	const { result: accounts } = V4Schema(AccountsSchema).parse(await accountsResponse.json())
	if (!user || !userResponse.ok) {
		// If accounts is present, then assume that we have an account scoped token
		if (accounts !== null) {
			return { user: null, accounts }
		}
		console.log(user)
		throw new McpError('Failed to fetch user', 500, { reportToSentry: true })
	}
	if (!accounts || !accountsResponse.ok) {
		console.log(accounts)
		throw new McpError('Failed to fetch accounts', 500, { reportToSentry: true })
	}

	return { user, accounts }
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
	clientSecret: string
): Promise<TokenExchangeCallbackResult | undefined> {
	// options.props contains the current props
	if (options.grantType === 'refresh_token') {
		const props = AuthProps.parse(options.props)
		if (props.type === 'account_token') {
			// Refreshing an account_token should not be possible, as we only do this for user tokens
			throw new McpError('Internal Server Error', 500)
		}
		if (!props.refreshToken) {
			throw new McpError('Missing refreshToken', 500)
		}

		// handle token refreshes
		const {
			access_token: accessToken,
			refresh_token: refreshToken,
			expires_in,
		} = await refreshAuthToken({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: props.refreshToken,
		})

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
 * Helper function to redirect to Cloudflare OAuth
 *
 * Note: We pass the stateToken as a simple string in the URL.
 * The existing getAuthorizationURL function will wrap it with the oauthReqInfo
 * and add the PKCE codeVerifier before base64-encoding.
 * On callback, we extract the stateToken, look up the original oauthReqInfo in KV.
 */
async function redirectToCloudflare(
	c: Context<AuthContext>,
	oauthReqInfo: AuthRequest,
	stateToken: string,
	scopes: Record<string, string>,
	additionalHeaders: Record<string, string> = {}
): Promise<Response> {
	// Create a modified oauthReqInfo that includes our stateToken
	// getAuthorizationURL will add the codeVerifier and base64 encode everything
	const stateWithToken: AuthRequest = {
		...oauthReqInfo,
		state: stateToken, // Embed our KV state token
	}

	const authUrl = await getAuthorizationURL({
		client_id: c.env.CLOUDFLARE_CLIENT_ID,
		redirect_uri: new URL('/oauth/callback', c.req.url).href,
		state: stateWithToken,
		scopes,
	})

	return new Response(null, {
		status: 302,
		headers: {
			...additionalHeaders,
			Location: authUrl.authUrl,
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
				const stateToken = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV)
				const { setCookie: sessionCookie } = await bindStateToSession(stateToken)

				return redirectToCloudflare(c, oauthReqInfo, stateToken, scopes, {
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
				return c.text(e.message, { status: e.code })
			}
			console.error(e)
			return c.text('Internal Error', 500)
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
			const stateToken = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV)
			const { setCookie: sessionCookie } = await bindStateToSession(stateToken)

			// Build redirect response
			const redirectResponse = await redirectToCloudflare(c, oauthReqInfo, stateToken, scopes)

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
			console.error(e)
			return c.text('Internal Error', 500)
		}
	})

	/**
	 * GET /oauth/callback - Handle OAuth callback from Cloudflare
	 */
	app.get(`/oauth/callback`, zValidator('query', AuthQuery), async (c) => {
		try {
			const { state: stateParam, code } = c.req.valid('query')

			// Validate state using dual validation (KV + session cookie)
			const { oauthReqInfo, clearCookie } = await validateOAuthState(c.req.raw, c.env.OAUTH_KV)

			if (!oauthReqInfo.clientId) {
				return new OAuthError('invalid_request', 'Invalid OAuth request info', 400).toResponse()
			}

			// Parse the state parameter to extract the encoded data
			const decodedState = AuthRequestSchemaWithExtraParams.parse(JSON.parse(atob(stateParam)))

			// Extract code verifier for PKCE validation
			const codeVerifier = decodedState.codeVerifier
			if (!codeVerifier) {
				return new OAuthError('invalid_request', 'Missing code verifier', 400).toResponse()
			}

			// Exchange code for tokens and get user details
			const [{ accessToken, refreshToken, user, accounts }] = await Promise.all([
				getTokenAndUserDetails(c, code, codeVerifier),
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
				return c.text(e.message, { status: e.code })
			}
			return c.text('Internal Error', 500)
		}
	})

	return app
}
