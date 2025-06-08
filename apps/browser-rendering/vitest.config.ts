import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

import type { Env } from './src/browser.context'

export interface TestEnv extends Env {
	CLOUDFLARE_MOCK_ACCOUNT_ID: string
	CLOUDFLARE_MOCK_API_TOKEN: string
}

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: `${__dirname}/wrangler.jsonc` },
				miniflare: {
					bindings: {
						CLOUDFLARE_MOCK_ACCOUNT_ID: 'mock-account-id',
						CLOUDFLARE_MOCK_API_TOKEN: 'mock-api-token',
					} satisfies Partial<TestEnv>,
				},
			},
		},
	},
})
