import { resourceMatches } from '@cloudflare/workers-oauth-provider'
import { describe, expect, it } from 'vitest'

import { createCloudflareOAuthRouter } from './oauth-router'

import type { MetricsTracker } from '@repo/mcp-observability'
import type { CloudflareOAuthEnv } from './oauth-router'

const apiHandler = {
	fetch() {
		return new Response('ok')
	},
}

const metrics = { logEvent() {} } as unknown as MetricsTracker
const mcpRequestPolicy = {
	allowedHostnames: ['mcp.example.com'],
	allowedOriginHostnames: ['mcp.example.com'],
}

describe('OAuth router resource policy', () => {
	it('uses exact RFC 8707 matching for same-origin resource paths', () => {
		expect(
			resourceMatches('https://mcp.example.com/other', 'https://mcp.example.com/mcp', false)
		).toBe(false)
		expect(
			resourceMatches('https://mcp.example.com/mcp', 'https://mcp.example.com/mcp', false)
		).toBe(true)
	})

	it('rejects the expired origin-only compatibility override', () => {
		expect(() =>
			createCloudflareOAuthRouter<CloudflareOAuthEnv>({
				apiHandler,
				scopes: {},
				metrics,
				mcpRequestPolicy,
				provider: { resourceMatchOriginOnly: true } as never,
			})
		).toThrow('resourceMatchOriginOnly')
	})
})
