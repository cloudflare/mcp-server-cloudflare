import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

import type { Env } from './src/cloudflare-blog.context'

export type TestEnv = Env

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: `${__dirname}/wrangler.jsonc` },
		}),
	],

	test: {},
})
