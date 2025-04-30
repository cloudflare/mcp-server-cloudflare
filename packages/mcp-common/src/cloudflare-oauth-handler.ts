import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { AuthUser } from '../../mcp-observability/src'
import { getAuthorizationURL, getAuthToken, refreshAuthToken } from './cloudflare-auth'
import { McpError } from './mcp-error'
import { useSentry } from './sentry'

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
export const AuthRequestSchemaWithExtraParams = AuthRequestSchema.merge(
	z.object({ codeVerifier: z.string() })
)

export const AuthQuery = z.object({
	code: z.string().describe('OAuth code from CF dash'),
	state: z.string().describe('Value of the OAuth state'),
	scope: z.string().describe('OAuth scopes granted'),
})

export type UserSchema = z.infer<typeof UserResponseSchema>
const UserResponseSchema = z.object({
	result: z.object({
		id: z.string(),
		email: z.string(),
	}),
})

export type AccountSchema = z.infer<typeof AccountResponseSchema>
const AccountResponseSchema = z.object({
	result: z.array(
		z.object({
			name: z.string(),
			id: z.string(),
		})
	),
})

export type AuthProps = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export async function getUserAndAccounts(
	accessToken: string,
	devModeHeaders?: HeadersInit
): Promise<{ user: UserSchema['result']; accounts: AccountSchema['result'] }> {
	const headers = devModeHeaders
		? devModeHeaders
		: {
				Authorization: `Bearer ${accessToken}`,
			}

	const [userResponse, accountsResponse] = await Promise.all([
		fetch('https://api.cloudflare.com/client/v4/user', {
			headers,
		}),
		fetch('https://api.cloudflare.com/client/v4/accounts', {
			headers,
		}),
	])

	if (!userResponse.ok) {
		console.log(await userResponse.text())
		throw new McpError('Failed to fetch user', 500, { reportToSentry: true })
	}
	if (!accountsResponse.ok) {
		console.log(await accountsResponse.text())
		throw new McpError('Failed to fetch accounts', 500, { reportToSentry: true })
	}

	// Fetch the user & accounts info from Cloudflare
	const { result: user } = UserResponseSchema.parse(await userResponse.json())
	const { result: accounts } = AccountResponseSchema.parse(await accountsResponse.json())

	return { user, accounts }
}

async function getTokenAndUserDetails(
	c: Context<AuthContext>,
	code: string,
	code_verifier: string
): Promise<{
	accessToken: string
	refreshToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
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

	return { accessToken, refreshToken, user, accounts }
}

export async function handleTokenExchangeCallback(
	options: TokenExchangeCallbackOptions,
	clientId: string,
	clientSecret: string
): Promise<TokenExchangeCallbackResult | undefined> {
	// options.props contains the current props
	if (options.grantType === 'refresh_token') {
		// handle token refreshes
		const {
			access_token: accessToken,
			refresh_token: refreshToken,
			expires_in,
		} = await refreshAuthToken({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: options.props.refreshToken,
		})

		return {
			newProps: {
				...options.props,
				accessToken,
				refreshToken,
			},
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
					// This will be available on this.props inside CASBMCP
					props: {
						user,
						accounts,
						accessToken,
						refreshToken,
					},
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
