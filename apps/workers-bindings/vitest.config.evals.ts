import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			miniflare: {
				bindings: {
					ENVIRONMENT: 'test',
				},
			},
		}),
	],

	test: {
		include: ['**/*.eval.?(c|m)[jt]s?(x)'],
	},
})
