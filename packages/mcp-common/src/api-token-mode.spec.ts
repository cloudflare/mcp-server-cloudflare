import { describe, expect, it } from 'vitest'

import { isApiTokenRequest } from './api-token-mode'

describe('isApiTokenRequest', () => {
	describe('DEV_DISABLE_OAUTH safety guards', () => {
		it('throws when DEV_DISABLE_OAUTH is enabled in production environment', async () => {
			const env = {
				DEV_CLOUDFLARE_API_TOKEN: 'secret-token',
				DEV_CLOUDFLARE_EMAIL: 'test@example.com',
				DEV_DISABLE_OAUTH: 'true',
				ENVIRONMENT: 'production' as const,
			}
			const req = new Request('https://example.com/mcp')

			await expect(isApiTokenRequest(req, env)).rejects.toThrow(
				'DEV_DISABLE_OAUTH must not be enabled in production or staging'
			)
		})

		it('throws when DEV_DISABLE_OAUTH is enabled in staging environment', async () => {
			const env = {
				DEV_CLOUDFLARE_API_TOKEN: 'secret-token',
				DEV_CLOUDFLARE_EMAIL: 'test@example.com',
				DEV_DISABLE_OAUTH: 'true',
				ENVIRONMENT: 'staging' as const,
			}
			const req = new Request('https://example.com/mcp')

			await expect(isApiTokenRequest(req, env)).rejects.toThrow(
				'DEV_DISABLE_OAUTH must not be enabled in production or staging'
			)
		})

		it('allows DEV_DISABLE_OAUTH in development environment', async () => {
			const env = {
				DEV_CLOUDFLARE_API_TOKEN: 'secret-token',
				DEV_CLOUDFLARE_EMAIL: 'test@example.com',
				DEV_DISABLE_OAUTH: 'true',
				ENVIRONMENT: 'development' as const,
			}
			const req = new Request('https://example.com/mcp')

			const result = await isApiTokenRequest(req, env)
			expect(result).toBe(true)
		})

		it('does not trigger guard when DEV_DISABLE_OAUTH is not set', async () => {
			const env = {
				DEV_CLOUDFLARE_API_TOKEN: '',
				DEV_CLOUDFLARE_EMAIL: '',
				DEV_DISABLE_OAUTH: '',
				ENVIRONMENT: 'production' as const,
			}
			const req = new Request('https://example.com/mcp')

			const result = await isApiTokenRequest(req, env)
			expect(result).toBe(false)
		})
	})

	describe('Bearer token detection', () => {
		const baseEnv = {
			DEV_CLOUDFLARE_API_TOKEN: '',
			DEV_CLOUDFLARE_EMAIL: '',
			DEV_DISABLE_OAUTH: '',
			ENVIRONMENT: 'production' as const,
		}

		it('returns false when no Authorization header', async () => {
			const req = new Request('https://example.com/mcp')
			expect(await isApiTokenRequest(req, baseEnv)).toBe(false)
		})

		it('returns false for non-Bearer auth', async () => {
			const req = new Request('https://example.com/mcp', {
				headers: { Authorization: 'Basic abc123' },
			})
			expect(await isApiTokenRequest(req, baseEnv)).toBe(false)
		})

		it('returns true for Bearer token not from OAuthProvider (no colons)', async () => {
			const req = new Request('https://example.com/mcp', {
				headers: { Authorization: 'Bearer my-api-token' },
			})
			expect(await isApiTokenRequest(req, baseEnv)).toBe(true)
		})

		it('returns false for Bearer token from OAuthProvider (3 colon-separated parts)', async () => {
			const req = new Request('https://example.com/mcp', {
				headers: { Authorization: 'Bearer part1:part2:part3' },
			})
			expect(await isApiTokenRequest(req, baseEnv)).toBe(false)
		})
	})
})
