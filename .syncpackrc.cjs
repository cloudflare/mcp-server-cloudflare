// @ts-check
/** @type {import("syncpack").RcFile} */
const config = {
	indent: '\t',
	lintFormatting: false, // handled by prettier
	versionGroups: [
		{
			label: 'use the workspace catalog for the MCP migration stack',
			dependencies: [
				'@cloudflare/workers-oauth-provider',
				'@modelcontextprotocol/client',
				'@modelcontextprotocol/sdk',
				'@modelcontextprotocol/server',
				'agents',
			],
			pinVersion: 'catalog:',
		},
		{
			label: 'local packages',
			packages: ['**'],
			dependencies: ['@repo/*'],
			dependencyTypes: ['!local'], // Exclude the local package itself
			pinVersion: 'workspace:*',
		},
		{
			label: 'Sentry types that are compatible with toucan-js',
			dependencies: ['@sentry/types', '@sentry/tracing'],
			pinVersion: '8.9.2',
		},
		{
			label: 'toucan-js that is compatible with pinned sentry types',
			dependencies: ['toucan-js'],
			pinVersion: '4.1.1',
		},
		{
			label: 'pin vitest compatible with @cloudflare/vitest-pool-workers',
			dependencies: ['vitest', '@vitest/ui'],
			pinVersion: '4.1.8',
		},
		{
			label: 'pin workspace typescript',
			dependencies: ['typescript'],
			pinVersion: '5.5.4',
		},
		{
			label: 'use zod v4 in packages/tools',
			dependencies: ['zod'],
			pinVersion: '4.4.3',
			packages: ['@repo/tools'],
		},
	],
	semverGroups: [
		{
			label: 'workspace catalogs resolve exact versions in pnpm-workspace.yaml',
			dependencies: [
				'@cloudflare/workers-oauth-provider',
				'@modelcontextprotocol/client',
				'@modelcontextprotocol/sdk',
				'@modelcontextprotocol/server',
				'agents',
			],
			isIgnored: true,
		},
		{
			label: 'pin all deps',
			range: '',
			dependencies: ['**'],
			packages: ['**'],
		},
	],
}

module.exports = config
