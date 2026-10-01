import { describe, expect, it } from 'vitest'

import {
	consentApprovalSecret,
	OAuthError,
	parseRedirectApproval,
	renderApprovalDialog,
} from './workers-oauth-utils'

import type { ConsentDescription } from '@cloudflare/workers-oauth-provider'

describe('OAuthError', () => {
	it('creates an error with code, description, and statusCode', () => {
		const err = new OAuthError('invalid_request', 'Missing parameter', 400)
		expect(err.code).toBe('invalid_request')
		expect(err.description).toBe('Missing parameter')
		expect(err.statusCode).toBe(400)
		expect(err.name).toBe('OAuthError')
		expect(err).toBeInstanceOf(Error)
	})

	it('generates a proper JSON response', () => {
		const err = new OAuthError('access_denied', 'CSRF check failed', 403)
		const response = err.toResponse()
		expect(response.status).toBe(403)
		expect(response.headers.get('Content-Type')).toBe('application/json')
	})

	it('includes error and error_description in response body', async () => {
		const err = new OAuthError('invalid_request', 'Bad state', 400)
		const response = err.toResponse()
		const body = await response.json()
		expect(body).toEqual({
			error: 'invalid_request',
			error_description: 'Bad state',
		})
	})

	it('preserves response headers', () => {
		const response = new OAuthError('temporarily_unavailable', 'Try again later', 429, {
			'Retry-After': '17',
		}).toResponse()

		expect(response.headers.get('retry-after')).toBe('17')
	})
})

/** POST the consent form with these fields. */
function consentPost(fields: Record<string, string>): Request {
	return new Request('https://example.com/oauth/authorize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields),
	})
}

async function expectOAuthError(promise: Promise<unknown>, code: string, status: number) {
	const error = await promise.then(
		() => undefined,
		(e: unknown) => e
	)
	expect(error).toBeInstanceOf(OAuthError)
	expect(error).toMatchObject({ code, statusCode: status })
}

describe('parseRedirectApproval', () => {
	it('throws OAuthError 405 for non-POST requests', async () => {
		await expectOAuthError(
			parseRedirectApproval(new Request('https://example.com/oauth/authorize')),
			'invalid_request',
			405
		)
	})

	it('throws OAuthError 400 without a consent handle', async () => {
		await expectOAuthError(
			parseRedirectApproval(consentPost({ decision: 'approve' })),
			'invalid_request',
			400
		)
	})

	it('returns the handle and an approve decision', async () => {
		await expect(
			parseRedirectApproval(consentPost({ handle: 'h1', decision: 'approve' }))
		).resolves.toEqual({ handle: 'h1', decision: 'approve' })
	})

	it('returns a deny decision for Cancel', async () => {
		await expect(
			parseRedirectApproval(consentPost({ handle: 'h1', decision: 'deny' }))
		).resolves.toEqual({ handle: 'h1', decision: 'deny' })
	})

	it('treats a missing decision as approval', async () => {
		await expect(parseRedirectApproval(consentPost({ handle: 'h1' }))).resolves.toEqual({
			handle: 'h1',
			decision: 'approve',
		})
	})
})

describe('renderApprovalDialog', () => {
	const consent: ConsentDescription = {
		clientId: 'client-1',
		clientName: '<script>alert(1)</script>',
		redirectUri: 'http://localhost:3000/callback',
		redirectHost: 'localhost',
		redirectIsLoopback: true,
		scope: ['account:read'],
	}

	function render(overrides: Partial<ConsentDescription> = {}) {
		return renderApprovalDialog(new Request('https://example.com/oauth/authorize?x=1'), {
			consent: { ...consent, ...overrides },
			server: { name: 'Test Server' },
			handle: 'handle-"1"',
			headers: new Headers({ 'Set-Cookie': '__Host-oauth-consent-x=y', 'X-Frame-Options': 'DENY' }),
		})
	}

	it('posts only the handle and offers approve and deny', async () => {
		const html = await render().text()
		expect(html).toContain('name="handle" value="handle-&quot;1&quot;"')
		expect(html).toContain('name="decision" value="approve"')
		expect(html).toContain('name="decision" value="deny"')
		expect(html).toContain('action="/oauth/authorize"')
		expect(html).not.toContain('name="state"')
	})

	it('escapes client-supplied values', async () => {
		const html = await render().text()
		expect(html).not.toContain('<script>alert(1)</script>')
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
	})

	it('warns about a local redirect and shows a CIMD client domain', async () => {
		expect(await render().text()).toContain('an app on your computer')
		const remote = await render({
			redirectUri: 'https://client.example.com/cb',
			redirectIsLoopback: false,
			clientDomain: 'client.example.com',
		}).text()
		expect(remote).not.toContain('an app on your computer')
		expect(remote).toContain('Published by')
	})

	it("sends beginConsent()'s headers with the page", () => {
		const response = render()
		expect(response.headers.get('set-cookie')).toBe('__Host-oauth-consent-x=y')
		expect(response.headers.get('x-frame-options')).toBe('DENY')
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
	})
})

describe('consentApprovalSecret', () => {
	it('derives a stable 64-character key from any cookie secret', async () => {
		const secret = await consentApprovalSecret('short')
		expect(secret).toMatch(/^[0-9a-f]{64}$/)
		expect(await consentApprovalSecret('short')).toBe(secret)
		expect(await consentApprovalSecret('other')).not.toBe(secret)
	})

	it('refuses an empty cookie secret', async () => {
		await expect(consentApprovalSecret('')).rejects.toThrow('MCP_COOKIE_ENCRYPTION_KEY')
	})
})
