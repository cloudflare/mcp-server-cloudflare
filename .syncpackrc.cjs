// @ts-check
/** @type {import("syncpack").RcFile} */
const config = {
	indent: '\t',
	lintFormatting: false, // handled by prettier
	versionGroups: [
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
			pinVersion: '3.0.9',
		},
		{
			label: 'pin typescript for eslint',
			dependencies: ['typescript'],
			pinVersion: '5.5.4',
		},
		{
			label: `pin eslint and all it's plugins for eslint v8`,
			dependencies: [
				'eslint',
				'@types/eslint',
				'eslint-config-prettier',
				'eslint-plugin-react-hooks',
				'eslint-plugin-unused-imports',
				'@typescript-eslint/eslint-plugin',
				'@typescript-eslint/parser',
			],
			// snapTo removes it from syncpack update list, which is the main goal
			snapTo: ['@repo/eslint-config'],
		},
		{
			label: 'use zod v4 in packages/tools',
			dependencies: ['zod'],
			pinVersion: '4.0.0-beta.20250505T195954',
			packages: ['@repo/tools'],
		},
	],
	semverGroups: [
		{
			label: 'pin all deps',
			range: '',
			dependencies: ['**'],
			packages: ['**'],
		},
	],
}

module.exports = config
