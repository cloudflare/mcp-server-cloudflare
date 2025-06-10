import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { AuthUser } from '../../mcp-observability/src'
import { getAuthorizationURL, getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'
import { useSentry } from './sentry'
import { V4Schema } from './v4-api'

import type {
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
		CLOUDFLARE_CLIENT_ID: string
		CLOUDFLARE_CLIENT_SECRET: string
	}
} & BaseHonoContext

const AuthRequestSchema = z.object({
	responseType: z.string(),
	clientId: z.string(),
	redirectUri: z.string(),
	scope: z.array(z.string()),
	state: z.string(),
	codeChallenge: z.string().optional(),
	codeChallengeMethod: z.string().optional(),
})

// AuthRequest but with extra params that we use in our authentication logic
const AuthRequestSchemaWithExtraParams = AuthRequestSchema.merge(
	z.object({ codeVerifier: z.string() })
)

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
	{
		const app = new Hono<AuthContext>()
		app.use(useSentry)
		// TODO: Add useOnError middleware rather than handling errors in each handler
		// app.onError(useOnError)
		/**
		 * OAuth Authorization Endpoint
		 *
		 * This route initiates the Cloudflare OAuth flow when a user wants to log in.
		 * It creates a random state parameter to prevent CSRF attacks and stores the
		 * original OAuth request information in KV storage for later retrieval.
		 * Then it redirects the user to Cloudflare's authorization page with the appropriate
		 * parameters so the user can authenticate and grant permissions.
		 */
		app.get(`/oauth/authorize`, async (c) => {
			try {
				const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)
				oauthReqInfo.scope = Object.keys(scopes)
				if (!oauthReqInfo.clientId) {
					return c.text('Invalid request', 400)
				}
				const res = await getAuthorizationURL({
					client_id: c.env.CLOUDFLARE_CLIENT_ID,
					redirect_uri: new URL('/oauth/callback', c.req.url).href,
					state: oauthReqInfo,
					scopes,
				})

				return Response.redirect(res.authUrl, 302)
			} catch (e) {
				c.var.sentry?.recordError(e)
				if (e instanceof Error) {
					metrics.logEvent(
						new AuthUser({
							errorMessage: `Authorize Error: ${e.name}: ${e.message}`,
						})
					)
				}
				if (e instanceof McpError) {
					return c.text(e.message, { status: e.code })
				}
				console.error(e)
				return c.text('Internal Error', 500)
			}
		})

		/**
		 * OAuth Callback Endpoint
		 *
		 * This route handles the callback from Cloudflare after user authentication.
		 * It exchanges the temporary code for an access token, then stores some
		 * user metadata & the auth token as part of the 'props' on the token passed
		 * down to the client. It ends by redirecting the client back to _its_ callback URL
		 */
		app.get(`/oauth/callback`, zValidator('query', AuthQuery), async (c) => {
			try {
				const { state, code } = c.req.valid('query')
				const oauthReqInfo = AuthRequestSchemaWithExtraParams.parse(JSON.parse(atob(state)))
				// Get the oathReqInfo out of KV
				if (!oauthReqInfo.clientId) {
					throw new McpError('Invalid State', 400)
				}

				const [{ accessToken, refreshToken, user, accounts }] = await Promise.all([
					getTokenAndUserDetails(c, code, oauthReqInfo.codeVerifier),
					c.env.OAUTH_PROVIDER.createClient({
						clientId: oauthReqInfo.clientId,
						tokenEndpointAuthMethod: 'none',
					}),
				])

				// TODO: Implement auth restriction in staging
				// if (
				// 	!user.email.endsWith("@cloudflare.com") &&
				// 	!(c.env.PERMITTED_USERS ?? []).includes(user.email)
				// ) {
				// 	throw new McpError(
				// 		`This user ${user.email} is not allowed to access this restricted MCP server`,
				// 		401,
				// 	);
				// }

				// Return back to the MCP client a new token
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

				return Response.redirect(redirectTo, 302)
			} catch (e) {
				c.var.sentry?.recordError(e)
				if (e instanceof Error) {
					console.error(e)
					metrics.logEvent(
						new AuthUser({
							errorMessage: `Callback Error: ${e.name}: ${e.message}`,
						})
					)
				}
				if (e instanceof McpError) {
					return c.text(e.message, { status: e.code })
				}
				return c.text('Internal Error', 500)
			}
		})

		return app
	}
}
