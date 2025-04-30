import { z } from 'zod'

import { McpError } from './mcp-error'

import type { AuthRequest } from '@cloudflare/workers-oauth-provider'

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
async function generatePKCECodes(): Promise<PKCECodes> {
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
}: {
	client_id: string
	redirect_uri: string
	state: AuthRequest
	scopes: Record<string, string>
}): Promise<{ authUrl: string; codeVerifier: string }> {
	const { codeChallenge, codeVerifier } = await generatePKCECodes()

	return {
		authUrl: generateAuthUrl({
			client_id,
			redirect_uri,
			state: btoa(JSON.stringify({ ...state, codeVerifier })),
			code_challenge: codeChallenge,
			scopes,
		}),
		codeVerifier: codeVerifier,
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
		console.log(await resp.text())
		throw new McpError('Failed to get OAuth token', 500, { reportToSentry: true })
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
		console.log(await resp.text())
		throw new McpError('Failed to get OAuth token', 500, { reportToSentry: true })
	}

	return AuthorizationToken.parse(await resp.json())
}
