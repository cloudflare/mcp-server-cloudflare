import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

import type { Env } from './server/sandbox.server.context'

// Worker transport and Durable Object boundary tests run under workerd.
export default defineConfig({
	plugins: [
		cloudflareTest({
			remoteBindings: false,
			wrangler: { configPath: `${__dirname}/wrangler.jsonc` },
			miniflare: {
				bindings: { ENVIRONMENT: 'test' } satisfies Partial<Env>,
			},
		}),
	],
	test: { include: ['server/**/*.spec.ts'] },
})
