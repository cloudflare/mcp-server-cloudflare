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
	serverName: string
	redirectUri: string
	cancelUri: string
	scopes: Record<string, string>
	state: Record<string, unknown>
	csrfToken: string
	setCookie: string
}

/** Renders the required MCP client consent interstitial before upstream OAuth. */
export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
	const { client, serverName, redirectUri, cancelUri, scopes, state, csrfToken, setCookie } =
		options
	const hostname = (value: string): string => {
		try {
			return new URL(value).hostname
		} catch {
			return value
		}
	}
	const redirectUrl = new URL(redirectUri)
	const clientName = sanitizeHtml(client?.clientName || 'Unknown MCP client')
	const clientHostname = sanitizeHtml(client ? hostname(client.clientId) : 'Unknown')
	const redirectHostname = sanitizeHtml(redirectUrl.hostname)
	const safeServerName = sanitizeHtml(serverName)
	const isLocalRedirect = ['127.0.0.1', '::1', 'localhost'].includes(redirectUrl.hostname)
	const scopeItems = Object.entries(scopes)
		.map(
			([scope, description]) => `
          <li>
            <code>${sanitizeHtml(scope)}</code>
            <span>${sanitizeHtml(description)}</span>
          </li>`
		)
		.join('')

	const htmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${clientName} | Cloudflare</title>
  <style>
    :root {
      /* Kumo-derived Cloudflare design tokens. */
      --brand: #f6821f;
      --brand-hover: #e5750f;
      --base: #fff;
      --canvas: #fbfbfb;
      --elevated: #fafafa;
      --hairline: #eee;
      --line: rgba(37, 37, 37, 0.1);
      --interact: #d4d4d4;
      --text: #262626;
      --text-subtle: #808080;
      --warning-bg: #fff7ed;
      --warning-line: #fed7aa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--canvas);
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 72px;
      padding: 0 32px;
      background: var(--base);
      border-bottom: 1px solid var(--hairline);
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: .02em; }
    .brand svg { width: 34px; color: var(--brand); }
    .divider { width: 1px; height: 28px; background: var(--interact); }
    .product { color: var(--text-subtle); font-size: 16px; }
    main { display: flex; justify-content: center; padding: 42px 24px; }
    .card {
      width: 100%;
      max-width: 640px;
      overflow: hidden;
      background: var(--base);
      border: 1px solid var(--hairline);
      border-radius: 12px;
    }
    .card-header { padding: 28px 32px; text-align: center; border-bottom: 1px solid var(--hairline); }
    h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -.02em; }
    .subtitle { margin: 0; color: var(--text-subtle); }
    .card-body { padding: 28px 32px 32px; }
    .client-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding: 8px 12px;
      background: var(--elevated);
      border: 1px solid var(--hairline);
      border-radius: 8px;
      font-weight: 600;
    }
    .client-icon {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 5px;
      background: var(--brand);
      color: white;
      font-size: 12px;
    }
    .details { overflow: hidden; margin-bottom: 20px; border: 1px solid var(--hairline); border-radius: 8px; background: var(--elevated); }
    .detail { display: flex; justify-content: space-between; gap: 24px; padding: 11px 14px; }
    .detail + .detail { border-top: 1px solid var(--hairline); }
    .detail span { color: var(--text-subtle); }
    .detail code { overflow-wrap: anywhere; text-align: right; font-weight: 600; }
    .warning { margin: -6px 0 22px; padding: 12px 14px; border: 1px solid var(--warning-line); border-radius: 8px; background: var(--warning-bg); }
    .section-label { margin: 0 0 10px; color: var(--text-subtle); font-weight: 500; }
    .permissions { margin: 0 0 28px; padding: 0; list-style: none; border: 1px solid var(--hairline); border-radius: 8px; }
    .permissions li { padding: 12px 14px; }
    .permissions li + li { border-top: 1px dashed var(--line); }
    .permissions code { font-weight: 600; }
    .permissions span { display: block; margin-top: 2px; color: var(--text-subtle); }
    .actions { display: flex; gap: 10px; padding-top: 20px; border-top: 1px solid var(--hairline); }
    .button { flex: 1; padding: 10px 16px; border: 1px solid var(--interact); border-radius: 8px; background: var(--base); color: var(--text); font: inherit; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; }
    .button:hover { background: var(--elevated); }
    button[type="submit"] { border-color: var(--brand); background: var(--brand); color: white; }
    button[type="submit"]:hover { border-color: var(--brand-hover); background: var(--brand-hover); }
    @media (max-width: 600px) {
      .header { height: 60px; padding: 0 20px; }
      main { padding: 20px 12px; }
      .card-header, .card-body { padding: 22px 20px; }
      .detail { display: block; }
      .detail code { display: block; margin-top: 3px; text-align: left; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      <svg viewBox="0 0 48 24" fill="currentColor" aria-hidden="true"><path d="M34.7 9.7a7.2 7.2 0 0 0-13.8-2.2A9.2 9.2 0 0 0 4.2 13H3a3 3 0 0 0 0 6h34.5a5 5 0 0 0-2.8-9.3Z"/><path opacity=".7" d="M39.5 12a5.5 5.5 0 0 0-5.2 3.7H18.8a3.3 3.3 0 0 0-3.1 2.3h27.8a4 4 0 0 0-4-6Z"/></svg>
      CLOUDFLARE
    </div>
    <div class="divider"></div>
    <div class="product">MCP Server</div>
  </header>
  <main>
    <section class="card">
      <div class="card-header">
        <h1>Authorize Application</h1>
        <p class="subtitle">Connect to ${safeServerName}</p>
      </div>
      <div class="card-body">
        <div class="client-badge"><span class="client-icon">MCP</span>${clientName}</div>
        <div class="details" aria-label="Client identity and redirect destination">
          <div class="detail"><span>Client ID hostname</span><code>${clientHostname}</code></div>
          <div class="detail"><span>Redirect URI hostname</span><code>${redirectHostname}</code></div>
        </div>
        ${
					isLocalRedirect
						? '<div class="warning" role="alert"><strong>Local redirect:</strong> this client will receive the authorization code on this device. Only continue if you trust the application that opened this page.</div>'
						: ''
				}
        <p class="section-label">Requested permissions (${Object.keys(scopes).length})</p>
        <ul class="permissions">${scopeItems}</ul>
        <form method="post" action="${sanitizeHtml(new URL(request.url).pathname)}">
          <input type="hidden" name="state" value="${btoa(JSON.stringify(state))}">
          <input type="hidden" name="csrf_token" value="${sanitizeHtml(csrfToken)}">
          <div class="actions">
            <a class="button" href="${sanitizeHtml(cancelUri)}">Cancel</a>
            <button class="button" type="submit">Continue</button>
          </div>
        </form>
      </div>
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
