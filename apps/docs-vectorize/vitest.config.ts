import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

import type { Env } from './src/docs-vectorize.context'

export interface TestEnv extends Env {
	CLOUDFLARE_MOCK_ACCOUNT_ID: string
	CLOUDFLARE_MOCK_API_TOKEN: string
}

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: `${__dirname}/wrangler.jsonc` },
			miniflare: {
				bindings: {
					CLOUDFLARE_MOCK_ACCOUNT_ID: 'mock-account-id',
					CLOUDFLARE_MOCK_API_TOKEN: 'mock-api-token',
				} satisfies Partial<TestEnv>,
			},
		}),
	],

	test: {},
})
