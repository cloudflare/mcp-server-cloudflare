import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
	test: {
		include: ['**/*.eval.?(c|m)[jt]s?(x)'],
		poolOptions: {
			workers: {
				isolatedStorage: true,
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
})
