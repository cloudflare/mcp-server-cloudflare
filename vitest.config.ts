import { defineConfig } from 'vitest/config'

// Vitest 4 replaced `vitest.workspace.ts` with `test.projects` in the root config.
export default defineConfig({
	test: {
		projects: [
			'apps/*/vitest.config.ts',
			'apps/*/vitest.config.node.ts',
			'packages/*/vitest.config.ts',
			'packages/*/vitest.config.node.ts',
		],
	},
})
