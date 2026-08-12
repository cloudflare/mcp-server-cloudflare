import { ExternalTokenError } from '@cloudflare/workers-oauth-provider'
import { z } from 'zod'

import { CloudflareAccountsSchema, CloudflareUserSchema } from './auth-props'
import { getUserAndAccounts } from './cloudflare-oauth-handler'
import { McpError } from './mcp-error'

import type {
	ResolveExternalTokenInput,
	ResolveExternalTokenResult,
} from '@cloudflare/workers-oauth-provider'
import type { AuthProps } from './auth-props'
import type { CloudflareTokenOwner } from './cloudflare-oauth-handler'

export interface DevAuthEnv {
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

export interface ExternalTokenEnv {
	OAUTH_KV: KVNamespace
}

export interface RequestHandler<Env> {
	fetch(req: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}

/**
 * Verified identities are cached against a digest of the credential so repeat
 * MCP requests do not re-probe the Cloudflare API. Revoking a credential still
 * revokes access: tool calls use the token itself, not the cached identity.
 */
const API_TOKEN_IDENTITY_CACHE_TTL_SECONDS = 2_592_000

const CachedIdentitySchema = z.object({
	user: CloudflareUserSchema.nullable(),
	accounts: CloudflareAccountsSchema,
})
type CachedIdentity = z.infer<typeof CachedIdentitySchema>

/** Prefixes are ownership hints; unprefixed legacy credentials remain supported. */
export function cloudflareTokenOwner(token: string): CloudflareTokenOwner {
	if (token.startsWith('cfat_')) return 'account'
	if (token.startsWith('cfoat_') || token.startsWith('cfut_')) return 'user'
	return 'unknown'
}

async function hashApiToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getCachedIdentity(
	token: string,
	tokenOwner: CloudflareTokenOwner,
	kv: KVNamespace
): Promise<CachedIdentity> {
	const cacheKey = `api-token-identity:v1:${await hashApiToken(token)}`

	try {
		const cachedValue = await kv.get(cacheKey, 'json')
		if (cachedValue !== null) {
			const cached = CachedIdentitySchema.safeParse(cachedValue)
			if (cached.success) return cached.data
			console.warn('API-token identity cache entry did not match expected shape; ignoring')
		}
	} catch (error) {
		console.warn('API-token identity cache read failed', error)
	}

	const { user, accounts, degraded } = await getUserAndAccounts(token, undefined, tokenOwner)
	const identity: CachedIdentity = { user, accounts }

	// A degraded identity may serve this request, but caching it would pin the
	// data loss for the full TTL; leaving it uncached self-heals on re-probe.
	if (!degraded) {
		try {
			await kv.put(cacheKey, JSON.stringify(identity), {
				expirationTtl: API_TOKEN_IDENTITY_CACHE_TTL_SECONDS,
			})
		} catch (error) {
			console.warn('API-token identity cache write failed', error)
		}
	}

	return identity
}

/** Converts a verified Cloudflare identity into the shared request props shape. */
function buildAuthProps(token: string, identity: CachedIdentity): AuthProps {
	if (identity.user === null) {
		const account = identity.accounts.at(0)
		if (!account) {
			throw new McpError('API token cannot access a Cloudflare account', 401, {
				reportToSentry: false,
			})
		}
		return { type: 'account_token', accessToken: token, account }
	}
	return {
		type: 'user_token',
		accessToken: token,
		user: identity.user,
		accounts: identity.accounts,
	}
}

function externalTokenError(error: McpError, tokenOwner: CloudflareTokenOwner): ExternalTokenError {
	const common = { description: error.message, headers: error.headers }

	if (error.code >= 500) {
		return new ExternalTokenError('server_error', { ...common, statusCode: error.code })
	}
	if (error.code === 429) {
		return new ExternalTokenError('temporarily_unavailable', { ...common, statusCode: 429 })
	}
	if (error.code === 403) {
		return new ExternalTokenError('insufficient_scope', {
			...common,
			statusCode: 403,
			requiredScopes: tokenOwner === 'account' ? ['account:read'] : ['user:read', 'account:read'],
		})
	}
	return new ExternalTokenError('invalid_token', { ...common, statusCode: 401 })
}

/**
 * Resolves direct Cloudflare API/OAuth credentials after the OAuth Provider's
 * internal token lookup misses. Expected validation failures become
 * ExternalTokenError so the provider returns a structured 401/403 with a
 * WWW-Authenticate challenge instead of an uncaught Worker exception.
 */
export async function resolveExternalToken({
	token,
	env,
}: ResolveExternalTokenInput<ExternalTokenEnv>): Promise<ResolveExternalTokenResult> {
	const tokenOwner = cloudflareTokenOwner(token)
	try {
		const identity = await getCachedIdentity(token, tokenOwner, env.OAUTH_KV)
		return { props: buildAuthProps(token, identity) }
	} catch (error) {
		if (error instanceof McpError) throw externalTokenError(error, tokenOwner)
		throw error
	}
}

/** Local development can disable OAuth entirely and use one fixed API token. */
export function devApiTokenModeEnabled(env: DevAuthEnv): boolean {
	return Boolean(env.DEV_CLOUDFLARE_API_TOKEN) && env.DEV_DISABLE_OAUTH === 'true'
}

/**
 * Serves one local-development request through the same stateless handler as
 * OAuth, bypassing the OAuth Provider. Props live on this request's
 * ExecutionContext only; no Agent or MCP session is used.
 */
export async function handleDevApiTokenMode<Env extends DevAuthEnv>(
	handler: RequestHandler<Env>,
	req: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	const token = env.DEV_CLOUDFLARE_API_TOKEN
	let identity: CachedIdentity
	try {
		identity = await getUserAndAccounts(token, undefined, cloudflareTokenOwner(token))
	} catch (error) {
		if (error instanceof McpError) {
			return new Response(
				JSON.stringify({ error: 'invalid_token', error_description: error.message }),
				{ status: error.code, headers: { 'Content-Type': 'application/json', ...error.headers } }
			)
		}
		throw error
	}
	;(ctx as { props: AuthProps }).props = buildAuthProps(token, identity)
	return handler.fetch(req, env, ctx)
}
