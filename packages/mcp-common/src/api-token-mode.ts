import { getUserAndAccounts } from './cloudflare-oauth-handler'

import type { McpAgent } from 'agents/mcp'
import type { AuthProps } from './cloudflare-oauth-handler'

interface RequiredEnv {
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

function extractBearerToken(authHeader: string | null): string | null {
	if (!authHeader?.startsWith('Bearer ')) return null
	const token = authHeader.slice(7).trim()
	return token || null
}

export async function isApiTokenRequest(req: Request, env: RequiredEnv) {
	// shortcircuit for dev
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		return true
	}

	const token = extractBearerToken(req.headers.get('Authorization'))
	if (!token) return false

	// Return true only if the token was issued by the OAuthProvider.
	// A token provisioned by the OAuthProvider has 3 parts, split by colons.
	const codeParts = token.split(':')
	return codeParts.length !== 3
}

export async function handleApiTokenMode<
	Env extends Cloudflare.Env,
	T extends typeof McpAgent<Env, unknown, Record<string, unknown>>,
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
		token = extractBearerToken(req.headers.get('Authorization'))
		if (!token) {
			return new Response(JSON.stringify({ error: 'Bearer token required' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			})
		}
	}

	const { user, accounts } = await getUserAndAccounts(token, opts)

	// `ExecutionContext.props` is typed readonly, but the agents runtime reads the props we set
	// here before the request is served, so assign through a typed mutable view.
	const ctxWithProps = ctx as { props: AuthProps }

	// If user is null, handle API token mode
	if (user === null) {
		ctxWithProps.props = {
			type: 'account_token',
			accessToken: token,
			// we always select the first account from the response,
			// this assumes that account owned tokens can only access one account
			account: accounts[0],
		}
	} else {
		ctxWithProps.props = {
			type: 'user_token',
			accessToken: token,
			user,
			accounts,
		}
	}
	return agent.serve('/mcp').fetch(req, env, ctx)
}
