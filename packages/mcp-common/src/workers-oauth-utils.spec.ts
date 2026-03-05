import { describe, expect, it, vi } from 'vitest'

import { OAuthError, parseRedirectApproval, validateOAuthState } from './workers-oauth-utils'

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
})

describe('parseRedirectApproval', () => {
	it('throws OAuthError 405 for non-POST requests', async () => {
		const request = new Request('https://example.com/oauth/authorize', {
			method: 'GET',
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(405)
			expect(err.code).toBe('invalid_request')
		}
	})

	it('throws OAuthError 400 for missing form token', async () => {
		const formData = new FormData()
		formData.set('state', btoa(JSON.stringify({ oauthReqInfo: { clientId: 'test' } })))
		// no csrf_token

		const request = new Request('https://example.com/oauth/authorize', {
			method: 'POST',
			body: formData,
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Missing required form token')
		}
	})

	it('throws OAuthError 403 for form token mismatch', async () => {
		const formData = new FormData()
		formData.set('csrf_token', 'form-token')
		formData.set('state', btoa(JSON.stringify({ oauthReqInfo: { clientId: 'test' } })))

		const request = new Request('https://example.com/oauth/authorize', {
			method: 'POST',
			body: formData,
			headers: {
				Cookie: '__Host-CSRF_TOKEN=different-token',
			},
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(403)
			expect(err.code).toBe('access_denied')
			expect(err.description).toBe('Request validation failed')
		}
	})

	it('throws OAuthError 400 for missing state', async () => {
		const csrfToken = 'matching-token'
		const formData = new FormData()
		formData.set('csrf_token', csrfToken)
		// no state

		const request = new Request('https://example.com/oauth/authorize', {
			method: 'POST',
			body: formData,
			headers: {
				Cookie: `__Host-CSRF_TOKEN=${csrfToken}`,
			},
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Missing state')
		}
	})

	it('throws OAuthError 400 for malformed state encoding', async () => {
		const csrfToken = 'matching-token'
		const formData = new FormData()
		formData.set('csrf_token', csrfToken)
		formData.set('state', '!!!not-valid-base64!!!')

		const request = new Request('https://example.com/oauth/authorize', {
			method: 'POST',
			body: formData,
			headers: {
				Cookie: `__Host-CSRF_TOKEN=${csrfToken}`,
			},
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Invalid state encoding')
		}
	})

	it('throws OAuthError 400 for invalid state data', async () => {
		const csrfToken = 'matching-token'
		const formData = new FormData()
		formData.set('csrf_token', csrfToken)
		formData.set('state', btoa(JSON.stringify({ noOauthReqInfo: true })))

		const request = new Request('https://example.com/oauth/authorize', {
			method: 'POST',
			body: formData,
			headers: {
				Cookie: `__Host-CSRF_TOKEN=${csrfToken}`,
			},
		})

		try {
			await parseRedirectApproval(request, 'test-secret')
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Invalid state data')
		}
	})
})

describe('validateOAuthState', () => {
	function createMockKV(data: Record<string, string | null> = {}) {
		return {
			get: vi.fn(async (key: string) => data[key] ?? null),
			put: vi.fn(async () => {}),
			delete: vi.fn(async () => {}),
		} as unknown as KVNamespace
	}

	it('throws OAuthError 400 for missing state parameter', async () => {
		const request = new Request('https://example.com/callback')
		const kv = createMockKV()

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Missing state parameter')
		}
	})

	it('throws OAuthError 400 for un-decodable state', async () => {
		const request = new Request('https://example.com/callback?state=not-base64-json!')
		const kv = createMockKV()

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Failed to decode state parameter')
		}
	})

	it('throws OAuthError 400 for state without token', async () => {
		// Valid base64 JSON but missing the 'state' field
		const state = btoa(JSON.stringify({ other: 'data' }))
		const request = new Request(`https://example.com/callback?state=${state}`)
		const kv = createMockKV()

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('State token not found')
		}
	})

	it('throws OAuthError 400 for expired/missing state in KV', async () => {
		const stateToken = 'test-state-token'
		const state = btoa(JSON.stringify({ state: stateToken }))
		const request = new Request(`https://example.com/callback?state=${state}`)
		const kv = createMockKV() // no data in KV

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('Invalid or expired state')
		}
	})

	it('throws OAuthError 400 for expired authorization session', async () => {
		const stateToken = 'test-state-token'
		const state = btoa(JSON.stringify({ state: stateToken }))
		const storedData = JSON.stringify({
			oauthReqInfo: {
				clientId: 'test-client',
				scope: ['read'],
				state: 'test',
				responseType: 'code',
				redirectUri: 'https://example.com',
			},
			codeVerifier: 'test-verifier',
		})
		const kv = createMockKV({ [`oauth:state:${stateToken}`]: storedData })

		const request = new Request(`https://example.com/callback?state=${state}`)
		// no Cookie header

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toContain('session expired')
		}
	})

	it('throws OAuthError 403 for state hash mismatch', async () => {
		const stateToken = 'test-state-token'
		const state = btoa(JSON.stringify({ state: stateToken }))
		const storedData = JSON.stringify({
			oauthReqInfo: {
				clientId: 'test-client',
				scope: ['read'],
				state: 'test',
				responseType: 'code',
				redirectUri: 'https://example.com',
			},
			codeVerifier: 'test-verifier',
		})
		const kv = createMockKV({ [`oauth:state:${stateToken}`]: storedData })

		const request = new Request(`https://example.com/callback?state=${state}`, {
			headers: {
				Cookie: '__Host-CONSENTED_STATE=wrong-hash-value',
			},
		})

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(403)
			expect(err.code).toBe('access_denied')
			expect(err.description).toBe('Session validation failed')
		}
	})

	it('throws OAuthError 400 for invalid stored state format', async () => {
		const stateToken = 'test-state-token'
		const state = btoa(JSON.stringify({ state: stateToken }))

		// Compute hash of stateToken to match cookie
		const encoder = new TextEncoder()
		const data = encoder.encode(stateToken)
		const hashBuffer = await crypto.subtle.digest('SHA-256', data)
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

		// Store invalid data (missing codeVerifier)
		const storedData = JSON.stringify({
			oauthReqInfo: { clientId: 'test-client' },
			// missing codeVerifier
		})
		const kv = createMockKV({ [`oauth:state:${stateToken}`]: storedData })

		const request = new Request(`https://example.com/callback?state=${state}`, {
			headers: {
				Cookie: `__Host-CONSENTED_STATE=${hashHex}`,
			},
		})

		try {
			await validateOAuthState(request, kv)
			expect.unreachable()
		} catch (e) {
			expect(e).toBeInstanceOf(OAuthError)
			const err = e as OAuthError
			expect(err.statusCode).toBe(400)
			expect(err.code).toBe('invalid_request')
			expect(err.description).toBe('Invalid authorization state')
		}
	})
})
