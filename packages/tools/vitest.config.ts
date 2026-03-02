import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		setupFiles: [`${__dirname}/src/test/setup.ts`],
		environment: 'node',
	},
})
