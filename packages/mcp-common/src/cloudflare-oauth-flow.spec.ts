import { getOAuthApi } from '@cloudflare/workers-oauth-provider'
import { env } from 'cloudflare:test'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { createAuthHandlers } from './cloudflare-oauth-handler'
import { server } from './test/msw-server'

import type { OAuthProviderOptions } from '@cloudflare/workers-oauth-provider'
import type { MetricsTracker } from '@repo/mcp-observability'

// The authorize, consent and callback routes against the real workers-oauth-provider helpers and
// KV; only Cloudflare's token endpoint and API are mocked.

const ORIGIN = 'https://mcp.example.com'
const RESOURCE = `${ORIGIN}/mcp`
const CLIENT_REDIRECT = 'https://client.example.com/callback'
const SCOPES = { 'account:read': 'Read accounts', 'user:read': 'Read user' }
const metrics = { logEvent() {} } as unknown as MetricsTracker
const kv = (env as unknown as { OAUTH_KV: KVNamespace }).OAUTH_KV

const providerOptions = {
	apiRoute: '/mcp',
	apiHandler: { fetch: () => new Response('unused') },
	defaultHandler: { fetch: () => new Response('unused') },
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	clientRegistrationEndpoint: '/register',
	resourceMetadata: { resource: RESOURCE },
} satisfies OAuthProviderOptions<{ OAUTH_KV: KVNamespace }>

const helpers = getOAuthApi(providerOptions, { OAUTH_KV: kv })
const authEnv = {
	OAUTH_KV: kv,
	OAUTH_PROVIDER: helpers,
	MCP_COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key',
	CLOUDFLARE_CLIENT_ID: 'cf-client',
	CLOUDFLARE_CLIENT_SECRET: 'cf-secret',
}
const executionCtx = {
	props: {},
	waitUntil() {},
	passThroughOnException() {},
} as ExecutionContext

/** One browser: keeps the cookies the routes set. */
class Browser {
	private cookies = new Map<string, string>()
	private app = createAuthHandlers({ scopes: SCOPES, metrics })

	async fetch(url: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers)
		if (this.cookies.size > 0) {
			headers.set('Cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '))
		}
		const response = await this.app.fetch(
			new Request(new URL(url, ORIGIN), { ...init, headers }),
			authEnv,
			executionCtx
		)
		for (const cookie of response.headers.getSetCookie()) {
			const [pair, ...attributes] = cookie.split(';')
			const [name, value] = pair.split('=')
			if (attributes.some((a) => a.trim().toLowerCase() === 'max-age=0')) this.cookies.delete(name)
			else this.cookies.set(name, value)
		}
		return response
	}

	postConsent(handle: string, decision: 'approve' | 'deny') {
		return this.fetch('/oauth/authorize', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ handle, decision }),
		})
	}
}

async function s256(value: string): Promise<string> {
	const digest = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	)
	return btoa(String.fromCharCode(...digest))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

async function authorizeUrl(): Promise<string> {
	const client = await helpers.createClient({
		redirectUris: [CLIENT_REDIRECT],
		tokenEndpointAuthMethod: 'none',
		clientName: 'Flow Test Client',
	})
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: client.clientId,
		redirect_uri: CLIENT_REDIRECT,
		state: 'client-state',
		code_challenge: await s256('client-verifier-'.repeat(4)),
		code_challenge_method: 'S256',
		resource: RESOURCE,
	})
	return `/oauth/authorize?${params}`
}

function consentHandle(html: string): string {
	const handle = html.match(/name="handle" value="([^"]+)"/)?.[1]
	if (!handle) throw new Error('consent page has no handle')
	return handle
}

/** Mock Cloudflare's token endpoint and identity API; returns the token request's form. */
function mockCloudflare(): { tokenForm?: URLSearchParams } {
	const seen: { tokenForm?: URLSearchParams } = {}
	server.use(
		http.post('https://dash.cloudflare.com/oauth2/token', async ({ request }) => {
			seen.tokenForm = new URLSearchParams(await request.text())
			return HttpResponse.json({
				access_token: 'cf-access',
				refresh_token: 'cf-refresh',
				expires_in: 3600,
				scope: 'account:read user:read',
				token_type: 'bearer',
			})
		}),
		http.get('https://api.cloudflare.com/client/v4/user', () =>
			HttpResponse.json({
				success: true,
				result: { id: 'user-1', email: 'user@example.com' },
				errors: [],
				messages: [],
			})
		),
		http.get('https://api.cloudflare.com/client/v4/accounts', () =>
			HttpResponse.json({
				success: true,
				result: [{ id: 'account-1', name: 'Account One' }],
				errors: [],
				messages: [],
			})
		)
	)
	return seen
}

describe('OAuth consent and Cloudflare sign-in', () => {
	it('approves, signs in at Cloudflare, and returns a code to the client', async () => {
		const browser = new Browser()
		const page = await browser.fetch(await authorizeUrl())
		expect(page.status).toBe(200)
		expect(page.headers.get('x-frame-options')).toBe('DENY')
		const html = await page.text()
		expect(html).toContain('Flow Test Client')
		expect(html).toContain(CLIENT_REDIRECT)

		const toCloudflare = await browser.postConsent(consentHandle(html), 'approve')
		expect(toCloudflare.status).toBe(302)
		const cloudflareUrl = new URL(toCloudflare.headers.get('location') ?? '')
		expect(cloudflareUrl.origin + cloudflareUrl.pathname).toBe(
			'https://dash.cloudflare.com/oauth2/auth'
		)
		expect(cloudflareUrl.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/oauth/callback`)
		expect(cloudflareUrl.searchParams.get('scope')).toBe('account:read user:read')
		const state = cloudflareUrl.searchParams.get('state') ?? ''

		const seen = mockCloudflare()
		const callback = `/oauth/callback?code=cf-code&state=${encodeURIComponent(state)}`
		const toClient = await browser.fetch(callback)
		expect(toClient.status).toBe(302)
		const clientUrl = new URL(toClient.headers.get('location') ?? '')
		expect(clientUrl.origin + clientUrl.pathname).toBe(CLIENT_REDIRECT)
		expect(clientUrl.searchParams.get('state')).toBe('client-state')
		expect(clientUrl.searchParams.get('code')).toBeTruthy()

		// The PKCE verifier beginUpstream() kept server-side matches the challenge sent to Cloudflare.
		expect(seen.tokenForm?.get('code')).toBe('cf-code')
		expect(await s256(seen.tokenForm?.get('code_verifier') ?? '')).toBe(
			cloudflareUrl.searchParams.get('code_challenge')
		)

		// The upstream state works once.
		const replay = await browser.fetch(callback)
		expect(replay.status).toBe(400)
	})

	it('skips the consent page for a client this browser already approved', async () => {
		const browser = new Browser()
		const url = await authorizeUrl()
		const page = await browser.fetch(url)
		await browser.postConsent(consentHandle(await page.text()), 'approve')

		const again = await browser.fetch(url)
		expect(again.status).toBe(302)
		expect(new URL(again.headers.get('location') ?? '').host).toBe('dash.cloudflare.com')

		// Another browser is asked.
		const elsewhere = await new Browser().fetch(url)
		expect(elsewhere.status).toBe(200)
	})

	it('sends access_denied back to the client when the user cancels', async () => {
		const browser = new Browser()
		const page = await browser.fetch(await authorizeUrl())

		const denied = await browser.postConsent(consentHandle(await page.text()), 'deny')
		expect(denied.status).toBe(302)
		const clientUrl = new URL(denied.headers.get('location') ?? '')
		expect(clientUrl.origin + clientUrl.pathname).toBe(CLIENT_REDIRECT)
		expect(clientUrl.searchParams.get('error')).toBe('access_denied')
		expect(clientUrl.searchParams.get('state')).toBe('client-state')
	})

	it('sends access_denied back to the client when Cloudflare sign-in is declined', async () => {
		const browser = new Browser()
		const page = await browser.fetch(await authorizeUrl())
		const toCloudflare = await browser.postConsent(consentHandle(await page.text()), 'approve')
		const state = new URL(toCloudflare.headers.get('location') ?? '').searchParams.get('state')

		const declined = await browser.fetch(
			`/oauth/callback?error=access_denied&state=${encodeURIComponent(state ?? '')}`
		)
		expect(declined.status).toBe(302)
		const clientUrl = new URL(declined.headers.get('location') ?? '')
		expect(clientUrl.origin + clientUrl.pathname).toBe(CLIENT_REDIRECT)
		expect(clientUrl.searchParams.get('error')).toBe('access_denied')
		expect(clientUrl.searchParams.get('state')).toBe('client-state')
	})

	it('refuses a consent form or callback from another browser', async () => {
		const browser = new Browser()
		const page = await browser.fetch(await authorizeUrl())
		const handle = consentHandle(await page.text())

		const forged = await new Browser().postConsent(handle, 'approve')
		expect(forged.status).toBe(400)

		const toCloudflare = await browser.postConsent(handle, 'approve')
		const state = new URL(toCloudflare.headers.get('location') ?? '').searchParams.get('state')
		const stolen = await new Browser().fetch(
			`/oauth/callback?code=cf-code&state=${encodeURIComponent(state ?? '')}`
		)
		expect(stolen.status).toBe(400)
	})
})
