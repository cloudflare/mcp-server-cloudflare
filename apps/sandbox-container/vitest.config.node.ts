import { defineConfig } from 'vitest/config'

// Container filesystem tests require the Node.js runtime.
export default defineConfig({
	test: {
		name: 'containers-mcp-node',
		include: ['container/**/*.spec.ts'],
		environment: 'node',
	},
})
