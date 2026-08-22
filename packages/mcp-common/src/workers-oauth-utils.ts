import { z } from 'zod'

import type { AuthRequest, ClientInfo } from '@cloudflare/workers-oauth-provider'

const COOKIE_NAME = '__Host-MCP_APPROVED_CLIENTS'
const ONE_YEAR_IN_SECONDS = 31536000

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
 * Imports a secret key string for HMAC-SHA256 signing.
 * @param secret - The raw secret key string.
 * @returns A promise resolving to the CryptoKey object.
 */
async function importKey(secret: string): Promise<CryptoKey> {
	if (!secret) {
		throw new Error('COOKIE_SECRET is not defined. A secret key is required for signing cookies.')
	}
	const enc = new TextEncoder()
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ hash: 'SHA-256', name: 'HMAC' },
		false, // not extractable
		['sign', 'verify'] // key usages
	)
}

/**
 * Signs data using HMAC-SHA256.
 * @param key - The CryptoKey for signing.
 * @param data - The string data to sign.
 * @returns A promise resolving to the signature as a hex string.
 */
async function signData(key: CryptoKey, data: string): Promise<string> {
	const enc = new TextEncoder()
	const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data))
	// Convert ArrayBuffer to hex string
	return Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/**
 * Verifies an HMAC-SHA256 signature.
 * @param key - The CryptoKey for verification.
 * @param signatureHex - The signature to verify (hex string).
 * @param data - The original data that was signed.
 * @returns A promise resolving to true if the signature is valid, false otherwise.
 */
async function verifySignature(
	key: CryptoKey,
	signatureHex: string,
	data: string
): Promise<boolean> {
	const enc = new TextEncoder()
	try {
		const signatureBytes = new Uint8Array(
			signatureHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16))
		)
		return await crypto.subtle.verify('HMAC', key, signatureBytes.buffer, enc.encode(data))
	} catch (e) {
		console.error('Error verifying signature:', e)
		return false
	}
}

/**
 * Parses the signed cookie and verifies its integrity.
 * @param cookieHeader - The value of the Cookie header from the request.
 * @param secret - The secret key used for signing.
 * @returns A promise resolving to the list of approved client IDs if the cookie is valid, otherwise null.
 */
async function getApprovedClientsFromCookie(
	cookieHeader: string | null,
	secret: string
): Promise<string[] | null> {
	if (!cookieHeader) return null

	const cookies = cookieHeader.split(';').map((c) => c.trim())
	const targetCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`))

	if (!targetCookie) return null

	const cookieValue = targetCookie.substring(COOKIE_NAME.length + 1)
	const parts = cookieValue.split('.')

	if (parts.length !== 2) {
		console.warn('Invalid cookie format received.')
		return null // Invalid format
	}

	const [signatureHex, base64Payload] = parts
	const payload = atob(base64Payload) // Assuming payload is base64 encoded JSON string

	const key = await importKey(secret)
	const isValid = await verifySignature(key, signatureHex, payload)

	if (!isValid) {
		console.warn('Cookie signature verification failed.')
		return null // Signature invalid
	}

	try {
		const approvedClients = JSON.parse(payload)
		if (!Array.isArray(approvedClients)) {
			console.warn('Cookie payload is not an array.')
			return null // Payload isn't an array
		}
		// Ensure all elements are strings
		if (!approvedClients.every((item) => typeof item === 'string')) {
			console.warn('Cookie payload contains non-string elements.')
			return null
		}
		return approvedClients as string[]
	} catch (e) {
		console.error('Error parsing cookie payload:', e)
		return null // JSON parsing failed
	}
}

/**
 * Checks if a given client ID has already been approved by the user,
 * based on a signed cookie.
 *
 * @param request - The incoming Request object to read cookies from.
 * @param clientId - The OAuth client ID to check approval for.
 * @param cookieSecret - The secret key used to sign/verify the approval cookie.
 * @returns A promise resolving to true if the client ID is in the list of approved clients in a valid cookie, false otherwise.
 */
export async function clientIdAlreadyApproved(
	request: Request,
	clientId: string,
	cookieSecret: string
): Promise<boolean> {
	if (!clientId) return false
	const cookieHeader = request.headers.get('Cookie')
	const approvedClients = await getApprovedClientsFromCookie(cookieHeader, cookieSecret)

	return approvedClients?.includes(clientId) ?? false
}

/**
 * Configuration for the approval dialog
 */
export interface ApprovalDialogOptions {
	client: ClientInfo | null
	redirectUri: string
	cancelUri: string
	scopes: readonly string[]
	state: Record<string, unknown>
	csrfToken: string
	setCookie: string
}

/** Renders the required MCP client consent interstitial before upstream OAuth. */
export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
	const { client, redirectUri, cancelUri, scopes, state, csrfToken, setCookie } = options
	const clientName = sanitizeHtml(client?.clientName || 'Unknown MCP client')
	const scopeItems = scopes.map((scope) => `<li><code>${sanitizeHtml(scope)}</code></li>`).join('')

	const htmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${clientName}</title>
  <style>
    :root {
      /* Kumo-derived Cloudflare design tokens. */
      --brand: #f6821f;
      --brand-hover: #e5750f;
      --base: #fff;
      --canvas: #fbfbfb;
      --elevated: #fafafa;
      --hairline: #eee;
      --interact: #d4d4d4;
      --text: #262626;
      --text-subtle: #808080;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--canvas);
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { display: flex; justify-content: center; padding: 48px 20px; }
    .card {
      width: 100%;
      max-width: 560px;
      padding: 32px;
      background: var(--base);
      border: 1px solid var(--hairline);
      border-radius: 12px;
    }
    h1 { margin: 0 0 28px; font-size: 20px; letter-spacing: -.02em; }
    dt { margin: 20px 0 8px; color: var(--text-subtle); font-weight: 500; }
    dd { margin: 0; }
    .redirect {
      display: block;
      padding: 12px 14px;
      overflow-wrap: anywhere;
      background: var(--elevated);
      border: 1px solid var(--hairline);
      border-radius: 8px;
    }
    ul { margin: 0; padding: 0; list-style: none; border: 1px solid var(--hairline); border-radius: 8px; }
    li { padding: 11px 14px; }
    li + li { border-top: 1px solid var(--hairline); }
    code { font-size: 13px; font-weight: 600; }
    .actions { display: flex; gap: 10px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--hairline); }
    .button {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid var(--interact);
      border-radius: 8px;
      background: var(--base);
      color: var(--text);
      font: inherit;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }
    .button:hover { background: var(--elevated); }
    button[type="submit"] { border-color: var(--brand); background: var(--brand); color: white; }
    button[type="submit"]:hover { border-color: var(--brand-hover); background: var(--brand-hover); }
    @media (max-width: 600px) { main { padding: 16px 12px; } .card { padding: 24px 20px; } }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Authorize ${clientName}</h1>
      <dl>
        <dt>Registered redirect URI</dt>
        <dd><code class="redirect">${sanitizeHtml(redirectUri)}</code></dd>
        <dt>Third-party API scopes requested</dt>
        <dd><ul>${scopeItems}</ul></dd>
      </dl>
      <form method="post" action="${sanitizeHtml(new URL(request.url).pathname)}">
        <input type="hidden" name="state" value="${btoa(JSON.stringify(state))}">
        <input type="hidden" name="csrf_token" value="${sanitizeHtml(csrfToken)}">
        <div class="actions">
          <a class="button" href="${sanitizeHtml(cancelUri)}">Cancel</a>
          <button class="button" type="submit">Continue</button>
        </div>
      </form>
    </section>
  </main>
</body>
</html>`

	return new Response(htmlContent, {
		headers: {
			'Content-Security-Policy':
				"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
			'Content-Type': 'text/html; charset=utf-8',
			'Referrer-Policy': 'no-referrer',
			'Set-Cookie': setCookie,
			'X-Frame-Options': 'DENY',
		},
	})
}

/**
 * Result of parsing the approval form submission.
 */
export interface ParsedApprovalResult {
	/** The original state object containing the OAuth request information. */
	state: { oauthReqInfo?: AuthRequest }
	/** Headers to set on the redirect response, including the Set-Cookie header. */
	headers: Record<string, string>
}

/**
 * Parses the form submission from the approval dialog, extracts the state,
 * and generates Set-Cookie headers to mark the client as approved.
 *
 * @param request - The incoming POST Request object containing the form data.
 * @param cookieSecret - The secret key used to sign the approval cookie.
 * @returns A promise resolving to an object containing the parsed state and necessary headers.
 * @throws If the request method is not POST, form data is invalid, or state is missing.
 */
export async function parseRedirectApproval(
	request: Request,
	cookieSecret: string
): Promise<ParsedApprovalResult> {
	if (request.method !== 'POST') {
		throw new OAuthError('invalid_request', 'Invalid request method. Expected POST.', 405)
	}

	const formData = await request.formData()

	const tokenFromForm = formData.get('csrf_token')
	if (!tokenFromForm || typeof tokenFromForm !== 'string') {
		throw new OAuthError('invalid_request', 'Missing required form token', 400)
	}

	const cookieHeader = request.headers.get('Cookie') || ''
	const cookies = cookieHeader.split(';').map((c) => c.trim())
	const csrfCookie = cookies.find((c) => c.startsWith('__Host-CSRF_TOKEN='))
	const tokenFromCookie = csrfCookie ? csrfCookie.substring('__Host-CSRF_TOKEN='.length) : null

	if (!tokenFromCookie || tokenFromForm !== tokenFromCookie) {
		throw new OAuthError('access_denied', 'Request validation failed', 403)
	}

	const encodedState = formData.get('state')
	if (!encodedState || typeof encodedState !== 'string') {
		throw new OAuthError('invalid_request', 'Missing state in form data', 400)
	}

	let state: { oauthReqInfo?: AuthRequest }
	try {
		state = JSON.parse(atob(encodedState))
	} catch {
		throw new OAuthError('invalid_request', 'Invalid state encoding', 400)
	}
	if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
		throw new OAuthError('invalid_request', 'Invalid state data', 400)
	}

	const existingApprovedClients =
		(await getApprovedClientsFromCookie(request.headers.get('Cookie'), cookieSecret)) || []
	const updatedApprovedClients = Array.from(
		new Set([...existingApprovedClients, state.oauthReqInfo.clientId])
	)

	const payload = JSON.stringify(updatedApprovedClients)
	const key = await importKey(cookieSecret)
	const signature = await signData(key, payload)
	const newCookieValue = `${signature}.${btoa(payload)}` // signature.base64(payload)

	const headers: Record<string, string> = {
		'Set-Cookie': `${COOKIE_NAME}=${newCookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${ONE_YEAR_IN_SECONDS}`,
	}

	return { headers, state }
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

export function generateCSRFProtection(): { token: string; setCookie: string } {
	const token = crypto.randomUUID()
	const setCookie = `__Host-CSRF_TOKEN=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`
	return { token, setCookie }
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
	const consentedStateCookieName = '__Host-CONSENTED_STATE'

	// Hash the state token to provide defense-in-depth
	const encoder = new TextEncoder()
	const data = encoder.encode(stateToken)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

	const setCookie = `${consentedStateCookieName}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`

	return { setCookie }
}

/**
 * Validates OAuth state from the request, ensuring:
 * 1. The state parameter exists in KV (proves it was created by our server)
 * 2. The state hash matches the session cookie (proves this browser consented to it)
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
	const consentedStateCookieName = '__Host-CONSENTED_STATE'
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
	const consentedStateCookie = cookies.find((c) => c.startsWith(`${consentedStateCookieName}=`))
	const consentedStateHash = consentedStateCookie
		? consentedStateCookie.substring(consentedStateCookieName.length + 1)
		: null

	if (!consentedStateHash) {
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

	if (stateHash !== consentedStateHash) {
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
	const clearCookie = `${consentedStateCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`

	return {
		oauthReqInfo: parseResult.data.oauthReqInfo,
		codeVerifier: parseResult.data.codeVerifier,
		clearCookie,
	}
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param unsafe - The unsafe string that might contain HTML
 * @returns A safe string with HTML special characters escaped
 */
function sanitizeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}
