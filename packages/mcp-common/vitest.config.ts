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
					compatibilityDate: '2026-03-05',
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
})
