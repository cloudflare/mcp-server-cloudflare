import { getUserAndAccounts } from './cloudflare-oauth-handler'

import type { AuthProps } from './auth-props'

interface RequiredEnv {
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

export interface RequestHandler<Env> {
	fetch(req: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}

export async function isApiTokenRequest(req: Request, env: RequiredEnv) {
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		return true
	}

	const authHeader = req.headers.get('Authorization')
	if (!authHeader) return false

	const [type, token] = authHeader.split(' ')
	if (type !== 'Bearer' || !token) return false

	// OAuth Provider tokens have the provider's user:grant:secret format.
	return token.split(':').length !== 3
}

/** Validates an API token and returns the same request props shape as OAuth. */
export async function getApiTokenProps(req: Request, env: RequiredEnv): Promise<AuthProps> {
	let headers: HeadersInit | undefined
	let token: string

	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		token = env.DEV_CLOUDFLARE_API_TOKEN
		headers = { Authorization: `Bearer ${token}` }
	} else {
		const authHeader = req.headers.get('Authorization')
		if (!authHeader) {
			throw new Error('Authorization header is required')
		}

		const [type, tokenValue] = authHeader.split(' ')
		if (type !== 'Bearer' || !tokenValue) {
			throw new Error('Invalid authorization type, must be Bearer')
		}
		token = tokenValue
	}

	const { user, accounts } = await getUserAndAccounts(token, headers)
	if (user === null) {
		const account = accounts[0]
		if (!account) {
			throw new Error('API token cannot access a Cloudflare account')
		}
		return {
			type: 'account_token',
			accessToken: token,
			account,
		}
	}

	return {
		type: 'user_token',
		accessToken: token,
		user,
		accounts,
	}
}

/**
 * Serves one API-token request through the same stateless handler as OAuth.
 * Props live on this request's ExecutionContext only; no Agent or MCP session is used.
 */
export async function handleApiTokenMode<Env extends RequiredEnv>(
	handler: RequestHandler<Env>,
	req: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	const props = await getApiTokenProps(req, env)
	;(ctx as { props: AuthProps }).props = props
	return handler.fetch(req, env, ctx)
}
