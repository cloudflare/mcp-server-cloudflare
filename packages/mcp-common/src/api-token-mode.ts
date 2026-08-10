import { getUserAndAccounts } from './cloudflare-oauth-handler'
import { McpError } from './mcp-error'

import type { AuthProps } from './auth-props'
import type { CloudflareTokenOwner } from './cloudflare-oauth-handler'

interface RequiredEnv {
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

export interface RequestHandler<Env> {
	fetch(req: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}

function cloudflareTokenOwner(token: string): CloudflareTokenOwner {
	if (token.startsWith('cfat_')) return 'account'
	if (token.startsWith('cfoat_') || token.startsWith('cfut_')) return 'user'
	return 'unknown'
}

export async function isApiTokenRequest(req: Request, env: RequiredEnv) {
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		return true
	}

	const authHeader = req.headers.get('Authorization')
	if (!authHeader) return false

	const [type, token] = authHeader.split(' ')
	if (type !== 'Bearer' || !token) return false

	// MCP OAuth Provider tokens have a separate user:grant:secret format.
	// Every other bearer value may be a Cloudflare API/OAuth credential; ownership
	// prefixes are optimization hints, not an allowlist, so legacy values still work.
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

	const { user, accounts } = await getUserAndAccounts(token, headers, cloudflareTokenOwner(token))
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
	let props: AuthProps
	try {
		props = await getApiTokenProps(req, env)
	} catch (error) {
		if (error instanceof McpError) return apiTokenErrorResponse(req, error)
		throw error
	}
	;(ctx as { props: AuthProps }).props = props
	return handler.fetch(req, env, ctx)
}

function apiTokenErrorResponse(request: Request, error: McpError): Response {
	let oauthCode: string
	if (error.code >= 500) {
		oauthCode = 'server_error'
	} else if (error.code === 429) {
		oauthCode = 'temporarily_unavailable'
	} else if (error.code === 401) {
		oauthCode = 'invalid_token'
	} else if (error.code === 403) {
		oauthCode = 'insufficient_scope'
	} else {
		oauthCode = 'invalid_request'
	}
	const headers: Record<string, string> = {
		'Cache-Control': 'no-store',
		'Content-Type': 'application/json',
		Pragma: 'no-cache',
		...error.headers,
	}
	if (error.code === 401 || error.code === 403) {
		const url = new URL(request.url)
		const resourceMetadata = `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`
		headers['WWW-Authenticate'] =
			`Bearer realm="OAuth", resource_metadata="${resourceMetadata}", error="${oauthCode}"`
	}

	return new Response(
		JSON.stringify({
			error: oauthCode,
			error_description: error.message,
		}),
		{ status: error.code, headers }
	)
}
