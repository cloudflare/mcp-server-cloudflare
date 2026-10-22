import type { ConsentDescription } from '@cloudflare/workers-oauth-provider'

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
 * Configuration for the approval dialog
 */
export interface ApprovalDialogOptions {
	/**
	 * From `describeConsent()`: the client's name, the verified domain of a Client ID Metadata
	 * Document client, the redirect URI and whether it goes to a local app. Client-supplied.
	 */
	consent: ConsentDescription
	server: {
		name: string
		logo?: string
		description?: string
	}
	/** From `beginConsent()`: posted back so the provider can recover the stored request. */
	handle: string
	/** From `beginConsent()`: the browser binding cookie and anti-framing headers. */
	headers: Headers
}

/**
 * Renders the consent page. The authorization request stays server-side: the form posts only
 * the `beginConsent()` handle, which works once, in this browser.
 */
export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
	const { consent, server, handle, headers } = options

	const serverName = sanitizeHtml(server.name)
	const clientName = sanitizeHtml(consent.clientName)
	const serverDescription = server.description ? sanitizeHtml(server.description) : ''
	const logoUrl = server.logo ? sanitizeHtml(server.logo) : ''
	const clientUri = consent.clientUri ? sanitizeHtml(consent.clientUri) : ''
	// Only a Client ID Metadata Document client's ID names a domain it controls; a registered
	// client's name is self-asserted.
	const clientDomain = consent.clientDomain ? sanitizeHtml(consent.clientDomain) : ''
	const redirectUri = sanitizeHtml(consent.redirectUri)

	const detail = (label: string, value: string) => `
              <div class="client-detail">
                <div class="detail-label">${label}:</div>
                <div class="detail-value small">${value}</div>
              </div>`

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
          
          .warning {
            border: 1px solid #f5c26b;
            background-color: #fff8e6;
            border-radius: 6px;
            padding: 0.75rem 1rem;
            margin: 0 0 1.5rem;
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

            <h2 class="alert"><strong>${clientName}</strong> is requesting access</h2>

            <div class="client-info">
              ${detail('Name', clientName)}
              ${clientDomain ? detail('Published by', clientDomain) : ''}
              ${clientUri ? detail('Website', `<a href="${clientUri}" target="_blank" rel="noopener noreferrer">${clientUri}</a>`) : ''}
              ${detail('Redirect URI', redirectUri)}
            </div>

            ${
							consent.redirectIsLoopback
								? `<p class="warning">This sends access to an app on your computer. Continue only if you just started signing in from it.</p>`
								: ''
						}

            <p>This MCP Client is requesting to be authorized on ${serverName}. If you approve, you will be redirected to complete authentication.</p>

            <form method="post" action="${new URL(request.url).pathname}">
              <input type="hidden" name="handle" value="${sanitizeHtml(handle)}">

              <div class="actions">
                <button type="submit" name="decision" value="deny" class="button button-secondary">Cancel</button>
                <button type="submit" name="decision" value="approve" class="button button-primary">Approve</button>
              </div>
            </form>
          </div>
        </div>
      </body>
    </html>
  `

	// beginConsent() headers: the browser binding cookie, frame-ancestors 'none', X-Frame-Options DENY
	headers.set('Content-Type', 'text/html; charset=utf-8')
	return new Response(htmlContent, { headers })
}

/**
 * The consent form submission. The authorization request itself is not in the form:
 * workers-oauth-provider keeps it server-side under `handle`.
 */
export interface ParsedApprovalResult {
	handle: string
	decision: 'approve' | 'deny'
}

/**
 * Parses the consent form. Forgery and replay are refused by `approveConsent()` /
 * `denyConsent()`, which bind `handle` to this browser and accept it once.
 */
export async function parseRedirectApproval(request: Request): Promise<ParsedApprovalResult> {
	if (request.method !== 'POST') {
		throw new OAuthError('invalid_request', 'Invalid request method. Expected POST.', 405)
	}

	const formData = await request.formData()
	const handle = formData.get('handle')
	if (!handle || typeof handle !== 'string') {
		throw new OAuthError('invalid_request', 'Missing consent handle', 400)
	}

	return { handle, decision: formData.get('decision') === 'deny' ? 'deny' : 'approve' }
}

/**
 * The HMAC key for remembered consent (`isConsentRemembered()` / `approveConsent()`), derived from
 * the cookie encryption secret: the library needs at least 32 characters and a key of its own.
 */
export async function consentApprovalSecret(cookieEncryptionKey: string): Promise<string> {
	if (!cookieEncryptionKey) {
		throw new Error('MCP_COOKIE_ENCRYPTION_KEY is required to remember consent')
	}
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`mcp-consent-approvals:${cookieEncryptionKey}`)
	)
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
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
