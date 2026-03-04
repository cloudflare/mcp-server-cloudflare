import { z } from 'zod'

import { McpError, safeStatusCode } from './mcp-error'

import type { AuthRequest } from '@cloudflare/workers-oauth-provider'

/** Maps known OAuth error codes to safe client-facing messages */
const SAFE_TOKEN_ERROR_MESSAGES: Record<string, string> = {
	invalid_grant: 'Authorization grant is invalid, expired, or revoked',
	invalid_client: 'Client authentication failed',
	invalid_request: 'Invalid token request',
	unauthorized_client: 'Client is not authorized for this grant type',
	unsupported_grant_type: 'Unsupported grant type',
	invalid_scope: 'Requested scope is invalid',
	access_denied: 'Access denied',
}

// Constants
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const RECOMMENDED_CODE_VERIFIER_LENGTH = 96
function base64urlEncode(value: string): string {
	let base64 = btoa(value)
	base64 = base64.replace(/\+/g, '-')
	base64 = base64.replace(/\//g, '_')
	base64 = base64.replace(/=/g, '')
	return base64
}

interface PKCECodes {
	codeChallenge: string
	codeVerifier: string
}
export async function generatePKCECodes(): Promise<PKCECodes> {
	const output = new Uint32Array(RECOMMENDED_CODE_VERIFIER_LENGTH)
	crypto.getRandomValues(output)
	const codeVerifier = base64urlEncode(
		Array.from(output)
			.map((num: number) => PKCE_CHARSET[num % PKCE_CHARSET.length])
			.join('')
	)
	const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
	const hash = new Uint8Array(buffer)
	let binary = ''
	const hashLength = hash.byteLength
	for (let i = 0; i < hashLength; i++) {
		binary += String.fromCharCode(hash[i])
	}
	const codeChallenge = base64urlEncode(binary) //btoa(binary);
	return { codeChallenge, codeVerifier }
}

function generateAuthUrl({
	client_id,
	redirect_uri,
	state,
	code_challenge,
	scopes,
}: {
	client_id: string
	redirect_uri: string
	code_challenge: string
	state: string
	scopes: Record<string, string>
}) {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id,
		redirect_uri,
		state,
		code_challenge,
		code_challenge_method: 'S256',
		scope: Object.keys(scopes).join(' '),
	})

	const upstream = new URL(`https://dash.cloudflare.com/oauth2/auth?${params.toString()}`)
	return upstream.href
}

/**
 * Constructs an authorization URL for Cloudflare.
 *
 * @param {Object} options
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} [options.state] - The state parameter.
 *
 * @returns {string} The authorization URL.
 */
export async function getAuthorizationURL({
	client_id,
	redirect_uri,
	state,
	scopes,
	codeChallenge,
}: {
	client_id: string
	redirect_uri: string
	state: AuthRequest
	scopes: Record<string, string>
	codeChallenge: string
}): Promise<{ authUrl: string }> {
	return {
		authUrl: generateAuthUrl({
			client_id,
			redirect_uri,
			state: btoa(JSON.stringify(state)),
			code_challenge: codeChallenge,
			scopes,
		}),
	}
}

type AuthorizationToken = z.infer<typeof AuthorizationToken>
const AuthorizationToken = z.object({
	access_token: z.string(),
	expires_in: z.number(),
	refresh_token: z.string(),
	scope: z.string(),
	token_type: z.string(),
})
/**
 * Fetches an authorization token from Cloudflare.
 *
 * @param {Object} options
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.client_secret - The client secret of the application.
 * @param {string} options.code - The authorization code.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 *
 * @returns {Promise<[string, null] | [null, Response]>} A promise that resolves to an array containing the access token or an error response.
 */
export async function getAuthToken({
	client_id,
	client_secret,
	redirect_uri,
	code_verifier,
	code,
}: {
	client_id: string
	client_secret: string
	redirect_uri: string
	code_verifier: string
	code: string
}): Promise<AuthorizationToken> {
	if (!code) {
		throw new McpError('Missing code', 400)
	}

	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id,
		redirect_uri,
		code,
		code_verifier,
	}).toString()
	const resp = await fetch('https://dash.cloudflare.com/oauth2/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params,
	})

	if (!resp.ok) {
		const body = await resp.text()
		let upstreamError: { error?: string; error_description?: string } = {}
		try {
			upstreamError = JSON.parse(body)
		} catch (_e) {
			// upstream may return non-JSON error bodies
		}

		if (resp.status >= 400 && resp.status < 500) {
			throw new McpError(
				SAFE_TOKEN_ERROR_MESSAGES[upstreamError.error || ''] || 'Token exchange failed',
				safeStatusCode(resp.status),
				{
					reportToSentry: false,
					internalMessage: `Upstream ${resp.status}: ${body}`,
				}
			)
		}

		// Genuine upstream server error
		throw new McpError('Upstream token service unavailable', 502, {
			reportToSentry: true,
			internalMessage: `Upstream ${resp.status}: ${body}`,
		})
	}

	return AuthorizationToken.parse(await resp.json())
}

export async function refreshAuthToken({
	client_id,
	client_secret,
	refresh_token,
}: {
	client_id: string
	client_secret: string
	refresh_token: string
}): Promise<AuthorizationToken> {
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		client_id,
		refresh_token,
	})

	const resp = await fetch('https://dash.cloudflare.com/oauth2/token', {
		method: 'POST',
		body: params.toString(),
		headers: {
			Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	})
	if (!resp.ok) {
		const body = await resp.text()
		let upstreamError: { error?: string; error_description?: string } = {}
		try {
			upstreamError = JSON.parse(body)
		} catch (_e) {
			// upstream may return non-JSON error bodies
		}

		if (resp.status >= 400 && resp.status < 500) {
			throw new McpError(
				SAFE_TOKEN_ERROR_MESSAGES[upstreamError.error || ''] || 'Token refresh failed',
				safeStatusCode(resp.status),
				{
					reportToSentry: false,
					internalMessage: `Upstream ${resp.status}: ${body}`,
				}
			)
		}

		// Genuine upstream server error
		throw new McpError('Upstream token service unavailable', 502, {
			reportToSentry: true,
			internalMessage: `Upstream ${resp.status}: ${body}`,
		})
	}

	return AuthorizationToken.parse(await resp.json())
}
