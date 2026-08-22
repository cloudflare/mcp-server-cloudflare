import { z } from 'zod'

import type { AuthRequest } from '@cloudflare/workers-oauth-provider'

/**
 * OAuth error class for handling OAuth-specific errors
 */
export class OAuthError extends Error {
	constructor(
		public code: string,
		public description: string,
		public statusCode = 400,
		public headers: Record<string, string> = {}
	) {
		super(description)
		this.name = 'OAuthError'
	}

	toResponse(): Response {
		return new Response(
			JSON.stringify({
				error: this.code,
				error_description: this.description,
			}),
			{
				status: this.statusCode,
				headers: { 'Content-Type': 'application/json', ...this.headers },
			}
		)
	}
}

/**
 * Result from bindStateToSession containing the cookie to set
 */
export interface BindStateResult {
	/**
	 * Set-Cookie header value to bind the state to the user's session
	 */
	setCookie: string
}

/**
 * Result from validateOAuthState containing the original OAuth request info and cookie to clear
 */
export interface ValidateStateResult {
	/**
	 * The original OAuth request information that was stored with the state token
	 */
	oauthReqInfo: AuthRequest

	/**
	 * The PKCE code verifier retrieved from server-side storage (never transmitted to client)
	 */
	codeVerifier: string

	/**
	 * Set-Cookie header value to clear the state cookie
	 */
	clearCookie: string
}

export async function createOAuthState(
	oauthReqInfo: AuthRequest,
	kv: KVNamespace,
	codeVerifier: string
): Promise<string> {
	const stateToken = crypto.randomUUID()
	const stateData = { oauthReqInfo, codeVerifier } satisfies {
		oauthReqInfo: AuthRequest
		codeVerifier: string
	}

	await kv.put(`oauth:state:${stateToken}`, JSON.stringify(stateData), {
		expirationTtl: 600,
	})
	return stateToken
}

/**
 * Binds an OAuth state token to the user's browser session using a secure cookie.
 *
 * @param stateToken - The state token to bind to the session
 * @returns Object containing the Set-Cookie header to send to the client
 */
export async function bindStateToSession(stateToken: string): Promise<BindStateResult> {
	const oauthStateCookieName = '__Host-CONSENTED_STATE'

	// Hash the state token to provide defense-in-depth
	const encoder = new TextEncoder()
	const data = encoder.encode(stateToken)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

	const setCookie = `${oauthStateCookieName}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`

	return { setCookie }
}

/**
 * Validates OAuth state from the request, ensuring:
 * 1. The state parameter exists in KV (proves it was created by our server)
 * 2. The state hash matches the session cookie (proves this browser initiated the flow)
 *
 * This prevents attacks where an attacker's valid state token is injected into
 * a victim's OAuth flow.
 *
 * @param request - The HTTP request containing state parameter and cookies
 * @param kv - Cloudflare KV namespace for storing OAuth state data
 * @returns Object containing the original OAuth request info and cookie to clear
 * @throws If state is missing, mismatched, or expired
 */
export async function validateOAuthState(
	request: Request,
	kv: KVNamespace
): Promise<ValidateStateResult> {
	const oauthStateCookieName = '__Host-CONSENTED_STATE'
	const url = new URL(request.url)
	const stateFromQuery = url.searchParams.get('state')

	if (!stateFromQuery) {
		throw new OAuthError('invalid_request', 'Missing state parameter', 400)
	}

	// Decode the state parameter to extract the embedded stateToken
	let stateToken: string
	try {
		const decodedState = JSON.parse(atob(stateFromQuery))
		stateToken = decodedState.state
		if (!stateToken) {
			throw new OAuthError('invalid_request', 'State token not found in decoded state', 400)
		}
	} catch (e) {
		if (e instanceof OAuthError) throw e
		throw new OAuthError('invalid_request', 'Failed to decode state parameter', 400)
	}

	const storedDataJson = await kv.get(`oauth:state:${stateToken}`)
	if (!storedDataJson) {
		throw new OAuthError('invalid_request', 'Invalid or expired state', 400)
	}

	const cookieHeader = request.headers.get('Cookie') || ''
	const cookies = cookieHeader.split(';').map((c) => c.trim())
	const oauthStateCookie = cookies.find((c) => c.startsWith(`${oauthStateCookieName}=`))
	const oauthStateHash = oauthStateCookie
		? oauthStateCookie.substring(oauthStateCookieName.length + 1)
		: null

	if (!oauthStateHash) {
		throw new OAuthError(
			'invalid_request',
			'Authorization session expired, please restart the flow',
			400
		)
	}

	const encoder = new TextEncoder()
	const data = encoder.encode(stateToken)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	const stateHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

	if (stateHash !== oauthStateHash) {
		throw new OAuthError('access_denied', 'Session validation failed', 403)
	}

	// Parse and validate stored OAuth state data
	const StoredOAuthStateSchema = z.object({
		oauthReqInfo: z
			.object({
				clientId: z.string(),
				scope: z.array(z.string()),
				state: z.string(),
				responseType: z.string(),
				redirectUri: z.string(),
			})
			.passthrough(), // preserve any other fields from oauth-provider
		codeVerifier: z.string().min(1), // Our code verifier for Cloudflare OAuth
	})

	const parseResult = StoredOAuthStateSchema.safeParse(JSON.parse(storedDataJson))
	if (!parseResult.success) {
		throw new OAuthError('invalid_request', 'Invalid authorization state', 400)
	}

	await kv.delete(`oauth:state:${stateToken}`)
	const clearCookie = `${oauthStateCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`

	return {
		oauthReqInfo: parseResult.data.oauthReqInfo,
		codeVerifier: parseResult.data.codeVerifier,
		clearCookie,
	}
}
