import { getUserAndAccounts } from './cloudflare-oauth-handler'

import type { McpAgent } from 'agents/mcp'
import type { AuthProps } from './cloudflare-oauth-handler'

interface RequiredEnv {
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

export async function isApiTokenRequest(req: Request, env: RequiredEnv) {
	// shortcircuit for dev
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		return true
	}

	const authHeader = req.headers.get('Authorization')
	if (!authHeader) return false

	const [type, token] = authHeader.split(' ')
	if (type !== 'Bearer') return false

	// Return true only if the token was issued by the OAuthProvider.
	// A token provisioned by the OAuthProvider has 3 parts, split by colons.
	const codeParts = token.split(':')
	return codeParts.length !== 3
}

export async function handleApiTokenMode<
	T extends typeof McpAgent<unknown, unknown, Record<string, unknown>>,
>(agent: T, req: Request, env: RequiredEnv, ctx: ExecutionContext) {
	// Handle global API token case
	let opts, token
	// dev mode
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		opts = {
			Authorization: `Bearer ${env.DEV_CLOUDFLARE_API_TOKEN}`,
		}
		token = env.DEV_CLOUDFLARE_API_TOKEN
		// header mode
	} else {
		const authHeader = req.headers.get('Authorization')
		if (!authHeader) {
			throw new Error('Authorization header is required')
		}

		const [type, tokenStr] = authHeader.split(' ')
		if (type !== 'Bearer') {
			throw new Error('Invalid authorization type, must be Bearer')
		}
		token = tokenStr
	}

	const { user, accounts } = await getUserAndAccounts(token, opts)

	// If user is null, handle API token mode
	if (user === null) {
		ctx.props = {
			type: 'account_token',
			accessToken: token,
			// we always select the first account from the response,
			// this assumes that account owned tokens can only access one account
			account: accounts[0],
		} satisfies AuthProps
	} else {
		ctx.props = {
			type: 'user_token',
			accessToken: token,
			user,
			accounts,
		} satisfies AuthProps
	}
	return agent.serve('/mcp').fetch(req, env, ctx)
}
