import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'
import { experimental_readRawConfig } from 'wrangler'

import type { Env } from './server/sandbox.server.context'

/**
 * The pool's bundled wrangler predates the durable_object container scheduling policy and rejects
 * wrangler.jsonc. No test starts a container, so give the pool a copy without `containers`.
 */
function writePoolConfig(): string {
	const { rawConfig } = experimental_readRawConfig({ config: `${__dirname}/wrangler.jsonc` })
	const { containers: _containers, env: _env, ...config } = rawConfig
	const outDir = `${__dirname}/.wrangler/vitest`
	mkdirSync(outDir, { recursive: true })
	const configPath = `${outDir}/wrangler.json`
	writeFileSync(
		configPath,
		JSON.stringify({ ...config, main: path.resolve(__dirname, config.main ?? '') })
	)
	return configPath
}

// Worker transport and Durable Object boundary tests run under workerd.
export default defineConfig({
	plugins: [
		cloudflareTest({
			remoteBindings: false,
			wrangler: { configPath: writePoolConfig() },
			miniflare: {
				bindings: { ENVIRONMENT: 'test' } satisfies Partial<Env>,
			},
		}),
	],
	test: { include: ['server/**/*.spec.ts'] },
})
