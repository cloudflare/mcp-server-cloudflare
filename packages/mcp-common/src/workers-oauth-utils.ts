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
		public statusCode = 400
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
				headers: { 'Content-Type': 'application/json' },
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
	/**
	 * Client information to display in the approval dialog
	 */
	client: ClientInfo | null
	/**
	 * Server information to display in the approval dialog
	 */
	server: {
		name: string
		logo?: string
		description?: string
	}
	/**
	 * Arbitrary state data to pass through the approval flow
	 * Will be encoded in the form and returned when approval is complete
	 */
	state: Record<string, any>
	/**
	 * CSRF token to include in the approval form
	 */
	csrfToken: string
	/**
	 * Set-Cookie header to include in the approval response
	 */
	setCookie: string
}

/**
 * Renders an approval dialog for OAuth authorization
 * The dialog displays information about the client and server
 * and includes a form to submit approval
 *
 * @param request - The HTTP request
 * @param options - Configuration for the approval dialog
 * @returns A Response containing the HTML approval dialog
 */
export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
	const { client, server, state, csrfToken, setCookie } = options
	const encodedState = btoa(JSON.stringify(state))

	const serverName = sanitizeHtml(server.name)
	const clientName = client?.clientName ? sanitizeHtml(client.clientName) : 'Unknown MCP Client'
	const serverDescription = server.description ? sanitizeHtml(server.description) : ''

	const logoUrl = server.logo ? sanitizeHtml(server.logo) : ''
	const clientUri = client?.clientUri ? sanitizeHtml(client.clientUri) : ''
	const policyUri = client?.policyUri ? sanitizeHtml(client.policyUri) : ''
	const tosUri = client?.tosUri ? sanitizeHtml(client.tosUri) : ''

	const contacts =
		client?.contacts && client.contacts.length > 0 ? sanitizeHtml(client.contacts.join(', ')) : ''

	const redirectUris =
		client?.redirectUris && client.redirectUris.length > 0
			? client.redirectUris.map((uri) => sanitizeHtml(uri)).filter((uri) => uri !== '')
			: []

	const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${clientName} | Authorization Request</title>
        <style>
          /* Modern, responsive styling with system fonts */
          :root {
            --primary-color: #0070f3;
            --error-color: #f44336;
            --border-color: #e5e7eb;
            --text-color: #333;
            --background-color: #fff;
            --card-shadow: 0 8px 36px 8px rgba(0, 0, 0, 0.1);
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                         Helvetica, Arial, sans-serif, "Apple Color Emoji", 
                         "Segoe UI Emoji", "Segoe UI Symbol";
            line-height: 1.6;
            color: var(--text-color);
            background-color: #f9fafb;
            margin: 0;
            padding: 0;
          }
          
          .container {
            max-width: 600px;
            margin: 2rem auto;
            padding: 1rem;
          }
          
          .precard {
            padding: 2rem;
            text-align: center;
          }
          
          .card {
            background-color: var(--background-color);
            border-radius: 8px;
            box-shadow: var(--card-shadow);
            padding: 2rem;
          }
          
          .header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
          }
          
          .logo {
            width: 48px;
            height: 48px;
            margin-right: 1rem;
            border-radius: 8px;
            object-fit: contain;
          }
          
          .title {
            margin: 0;
            font-size: 1.3rem;
            font-weight: 400;
          }
          
          .alert {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 400;
            margin: 1rem 0;
            text-align: center;
          }
          
          .description {
            color: #555;
          }
          
          .client-info {
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 1rem 1rem 0.5rem;
            margin-bottom: 1.5rem;
          }
          
          .client-name {
            font-weight: 600;
            font-size: 1.2rem;
            margin: 0 0 0.5rem 0;
          }
          
          .client-detail {
            display: flex;
            margin-bottom: 0.5rem;
            align-items: baseline;
          }
          
          .detail-label {
            font-weight: 500;
            min-width: 120px;
          }
          
          .detail-value {
            font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            word-break: break-all;
          }
          
          .detail-value a {
            color: inherit;
            text-decoration: underline;
          }
          
          .detail-value.small {
            font-size: 0.8em;
          }
          
          .external-link-icon {
            font-size: 0.75em;
            margin-left: 0.25rem;
            vertical-align: super;
          }
          
          .actions {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            margin-top: 2rem;
          }
          
          .button {
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            font-size: 1rem;
          }
          
          .button-primary {
            background-color: var(--primary-color);
            color: white;
          }
          
          .button-secondary {
            background-color: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-color);
          }
          
          /* Responsive adjustments */
          @media (max-width: 640px) {
            .container {
              margin: 1rem auto;
              padding: 0.5rem;
            }
            
            .card {
              padding: 1.5rem;
            }
            
            .client-detail {
              flex-direction: column;
            }
            
            .detail-label {
              min-width: unset;
              margin-bottom: 0.25rem;
            }
            
            .actions {
              flex-direction: column;
            }
            
            .button {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="precard">
            <div class="header">
              ${logoUrl ? `<img src="${logoUrl}" alt="${serverName} Logo" class="logo">` : ''}
            <h1 class="title"><strong>${serverName}</strong></h1>
            </div>
            
            ${serverDescription ? `<p class="description">${serverDescription}</p>` : ''}
          </div>
            
          <div class="card">
            
            <h2 class="alert"><strong>${clientName || 'A new MCP Client'}</strong> is requesting access</h1>
            
            <div class="client-info">
              <div class="client-detail">
                <div class="detail-label">Name:</div>
                <div class="detail-value">
                  ${clientName}
                </div>
              </div>
              
              ${
								clientUri
									? `
                <div class="client-detail">
                  <div class="detail-label">Website:</div>
                  <div class="detail-value small">
                    <a href="${clientUri}" target="_blank" rel="noopener noreferrer">
                      ${clientUri}
                    </a>
                  </div>
                </div>
              `
									: ''
							}
              
              ${
								policyUri
									? `
                <div class="client-detail">
                  <div class="detail-label">Privacy Policy:</div>
                  <div class="detail-value">
                    <a href="${policyUri}" target="_blank" rel="noopener noreferrer">
                      ${policyUri}
                    </a>
                  </div>
                </div>
              `
									: ''
							}
              
              ${
								tosUri
									? `
                <div class="client-detail">
                  <div class="detail-label">Terms of Service:</div>
                  <div class="detail-value">
                    <a href="${tosUri}" target="_blank" rel="noopener noreferrer">
                      ${tosUri}
                    </a>
                  </div>
                </div>
              `
									: ''
							}
              
              ${
								redirectUris.length > 0
									? `
                <div class="client-detail">
                  <div class="detail-label">Redirect URIs:</div>
                  <div class="detail-value small">
                    ${redirectUris.map((uri) => `<div>${uri}</div>`).join('')}
                  </div>
                </div>
              `
									: ''
							}
              
              ${
								contacts
									? `
                <div class="client-detail">
                  <div class="detail-label">Contact:</div>
                  <div class="detail-value">${contacts}</div>
                </div>
              `
									: ''
							}
            </div>
            
            <p>This MCP Client is requesting to be authorized on ${serverName}. If you approve, you will be redirected to complete authentication.</p>
            
            <form method="post" action="${new URL(request.url).pathname}">
              <input type="hidden" name="state" value="${encodedState}">
              <input type="hidden" name="csrf_token" value="${csrfToken}">

              <div class="actions">
                <button type="button" class="button button-secondary" onclick="window.history.back()">Cancel</button>
                <button type="submit" class="button button-primary">Approve</button>
              </div>
            </form>
          </div>
        </div>
      </body>
    </html>
  `

	return new Response(htmlContent, {
		headers: {
			'Content-Security-Policy': "frame-ancestors 'none'",
			'Content-Type': 'text/html; charset=utf-8',
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
		throw new Error('Invalid request method. Expected POST.')
	}

	const formData = await request.formData()

	const tokenFromForm = formData.get('csrf_token')
	if (!tokenFromForm || typeof tokenFromForm !== 'string') {
		throw new Error('Missing CSRF token in form data')
	}

	const cookieHeader = request.headers.get('Cookie') || ''
	const cookies = cookieHeader.split(';').map((c) => c.trim())
	const csrfCookie = cookies.find((c) => c.startsWith('__Host-CSRF_TOKEN='))
	const tokenFromCookie = csrfCookie ? csrfCookie.substring('__Host-CSRF_TOKEN='.length) : null

	if (!tokenFromCookie || tokenFromForm !== tokenFromCookie) {
		throw new Error('CSRF token mismatch')
	}

	const encodedState = formData.get('state')
	if (!encodedState || typeof encodedState !== 'string') {
		throw new Error('Missing state in form data')
	}

	const state = JSON.parse(atob(encodedState))
	if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
		throw new Error('Invalid state data')
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
		throw new Error('Missing state parameter')
	}

	// Decode the state parameter to extract the embedded stateToken
	let stateToken: string
	try {
		const decodedState = JSON.parse(atob(stateFromQuery))
		stateToken = decodedState.state
		if (!stateToken) {
			throw new Error('State token not found in decoded state')
		}
	} catch (e) {
		throw new Error('Failed to decode state parameter')
	}

	const storedDataJson = await kv.get(`oauth:state:${stateToken}`)
	if (!storedDataJson) {
		throw new Error('Invalid or expired state')
	}

	const cookieHeader = request.headers.get('Cookie') || ''
	const cookies = cookieHeader.split(';').map((c) => c.trim())
	const consentedStateCookie = cookies.find((c) => c.startsWith(`${consentedStateCookieName}=`))
	const consentedStateHash = consentedStateCookie
		? consentedStateCookie.substring(consentedStateCookieName.length + 1)
		: null

	if (!consentedStateHash) {
		throw new Error('Missing session binding cookie - authorization flow must be restarted')
	}

	const encoder = new TextEncoder()
	const data = encoder.encode(stateToken)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	const stateHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

	if (stateHash !== consentedStateHash) {
		throw new Error('State token does not match session - possible CSRF attack detected')
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
		throw new Error('Invalid OAuth state data format - PKCE security violation')
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
