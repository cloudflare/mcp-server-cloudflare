import path from 'node:path'
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'

export interface TestEnv {
	CLOUDFLARE_MOCK_ACCOUNT_ID: string
	CLOUDFLARE_MOCK_API_TOKEN: string
}

export default defineWorkersProject({
	test: {
		poolOptions: {
			workers: {
				singleWorker: true,
				miniflare: {
					compatibilityDate: '2026-03-09',
					compatibilityFlags: ['nodejs_compat'],
					bindings: {
						CLOUDFLARE_MOCK_ACCOUNT_ID: 'mock-account-id',
						CLOUDFLARE_MOCK_API_TOKEN: 'mock-api-token',
						DEV_DISABLE_OAUTH: false,
					},
				},
			},
		},
	},
	resolve: {
		alias: {
			// The real cloudflare SDK imports ReadStream from node:fs which is unavailable in workerd.
			// Alias to a lightweight mock that provides Cloudflare and APIError classes.
			cloudflare: path.resolve(__dirname, 'src/__mocks__/cloudflare.ts'),
		},
	},
})
