import path from 'node:path'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export interface TestEnv {
	CLOUDFLARE_MOCK_ACCOUNT_ID: string
	CLOUDFLARE_MOCK_API_TOKEN: string
}

export default defineConfig({
	plugins: [
		cloudflareTest({
			miniflare: {
				compatibilityDate: '2026-03-09',
				compatibilityFlags: ['nodejs_compat'],
				bindings: {
					CLOUDFLARE_MOCK_ACCOUNT_ID: 'mock-account-id',
					CLOUDFLARE_MOCK_API_TOKEN: 'mock-api-token',
					DEV_DISABLE_OAUTH: false,
				},
			},
		}),
	],

	test: {
		setupFiles: ['./src/test/msw-setup.ts'],
	},

	resolve: {
		alias: {
			// The real cloudflare SDK imports ReadStream from node:fs which is unavailable in workerd.
			// Alias to a lightweight mock that provides Cloudflare and APIError classes.
			cloudflare: path.resolve(__dirname, 'src/__mocks__/cloudflare.ts'),
		},
	},
})
