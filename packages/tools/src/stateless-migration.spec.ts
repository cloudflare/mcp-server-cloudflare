import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type Migration = {
	tag: string
	new_sqlite_classes?: string[]
	deleted_classes?: string[]
}

const root = path.resolve(__dirname, '../../..')

const appMigrations: Record<string, Migration[]> = {
	'ai-gateway': [
		{ tag: 'v1', new_sqlite_classes: ['AIGatewayMCP'] },
		{ tag: 'v2', deleted_classes: ['AIGatewayMCP'] },
	],
	auditlogs: [
		{ tag: 'v1', new_sqlite_classes: ['AuditlogMCP'] },
		{ tag: 'v2', deleted_classes: ['AuditlogMCP'] },
	],
	autorag: [
		{ tag: 'v1', new_sqlite_classes: ['AutoRAGMCP'] },
		{ tag: 'v2', deleted_classes: ['AutoRAGMCP'] },
	],
	'browser-rendering': [
		{ tag: 'v1', new_sqlite_classes: ['BrowserMCP'] },
		{ tag: 'v2', deleted_classes: ['BrowserMCP'] },
	],
	'cloudflare-blog': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareBlogMCP'] },
		{ tag: 'v2', deleted_classes: ['CloudflareBlogMCP'] },
	],
	'cloudflare-one-casb': [
		{ tag: 'v1', new_sqlite_classes: ['CASBMCP'] },
		{ tag: 'v2', deleted_classes: ['CASBMCP'] },
	],
	'demo-day': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareDemoDayMCP'] },
		{ tag: 'v2', deleted_classes: ['CloudflareDemoDayMCP'] },
	],
	'dex-analysis': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareDEXMCP'] },
		{ tag: 'v2', new_sqlite_classes: ['WarpDiagReader'] },
		{ tag: 'v3', deleted_classes: ['CloudflareDEXMCP'] },
	],
	'dns-analytics': [
		{ tag: 'v1', new_sqlite_classes: ['DNSAnalyticsMCP'] },
		{ tag: 'v2', deleted_classes: ['DNSAnalyticsMCP'] },
	],
	'docs-ai-search': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareDocumentationMCP'] },
		{ tag: 'v2', deleted_classes: ['CloudflareDocumentationMCP'] },
	],
	'docs-autorag': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareDocumentationMCP'] },
		{ tag: 'v2', deleted_classes: ['CloudflareDocumentationMCP'] },
	],
	'docs-vectorize': [
		{ tag: 'v1', new_sqlite_classes: ['CloudflareDocumentationMCP'] },
		{ tag: 'v2', deleted_classes: ['CloudflareDocumentationMCP'] },
	],
	graphql: [
		{ tag: 'v1', new_sqlite_classes: ['UserDetails', 'GraphQLMCP'] },
		{ tag: 'v2', deleted_classes: ['UserDetails'] },
		{ tag: 'v3', deleted_classes: ['GraphQLMCP'] },
	],
	logpush: [
		{ tag: 'v1', new_sqlite_classes: ['LogsMCP'] },
		{ tag: 'v2', deleted_classes: ['LogsMCP'] },
	],
	radar: [
		{ tag: 'v1', new_sqlite_classes: ['RadarMCP'] },
		{ tag: 'v2', deleted_classes: ['RadarMCP'] },
	],
	'sandbox-container': [
		{ tag: 'v1', new_sqlite_classes: ['ContainerManager', 'ContainerMcpAgent'] },
		{ tag: 'v2', new_sqlite_classes: ['UserContainer'] },
		{ tag: 'v3', deleted_classes: ['ContainerMcpAgent'] },
	],
	'workers-bindings': [
		{ tag: 'v1', new_sqlite_classes: ['WorkersBindingsMCP'] },
		{ tag: 'v2', deleted_classes: ['WorkersBindingsMCP'] },
	],
	'workers-builds': [
		{ tag: 'v1', new_sqlite_classes: ['UserDetails', 'BuildsMCP'] },
		{ tag: 'v2', deleted_classes: ['UserDetails'] },
		{ tag: 'v3', deleted_classes: ['BuildsMCP'] },
	],
	'workers-observability': [
		{ tag: 'v1', new_sqlite_classes: ['UserDetails', 'ObservabilityMCP'] },
		{ tag: 'v2', deleted_classes: ['UserDetails'] },
		{ tag: 'v3', deleted_classes: ['ObservabilityMCP'] },
	],
}

function wranglerPath(app: string): string {
	return path.join(root, 'apps', app, app === 'demo-day' ? 'wrangler.json' : 'wrangler.jsonc')
}

function extractArrayProperty<T>(source: string, property: string): T[] {
	const propertyIndex = source.indexOf(`"${property}"`)
	if (propertyIndex === -1) throw new Error(`Missing ${property}`)
	const start = source.indexOf('[', propertyIndex)
	if (start === -1) throw new Error(`Missing ${property} array`)

	let depth = 0
	let inString = false
	let escaped = false
	for (let index = start; index < source.length; index++) {
		const character = source[index]
		if (inString) {
			if (escaped) escaped = false
			else if (character === '\\') escaped = true
			else if (character === '"') inString = false
			continue
		}
		if (character === '"') inString = true
		else if (character === '[') depth++
		else if (character === ']' && --depth === 0) {
			return JSON.parse(source.slice(start, index + 1)) as T[]
		}
	}
	throw new Error(`Unterminated ${property} array`)
}

describe('stateless migration repository contract', () => {
	it('keeps every deployed Durable Object migration append-only and appends protocol-class deletions', () => {
		expect(Object.keys(appMigrations)).toHaveLength(19)
		for (const [app, expected] of Object.entries(appMigrations)) {
			const source = fs.readFileSync(wranglerPath(app), 'utf8')
			expect(extractArrayProperty<Migration>(source, 'migrations'), app).toEqual(expected)
			expect(source, `${app} must not bind the retired protocol object`).not.toContain(
				'"name": "MCP_OBJECT"'
			)
		}
	})

	it('advertises the actual Authorization bearer-token header', () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8')) as {
			remotes: Array<{ headers?: Array<{ name: string }> }>
		}
		const headerNames = manifest.remotes.flatMap((remote) =>
			(remote.headers ?? []).map((header) => header.name)
		)
		expect(headerNames.length).toBeGreaterThan(0)
		expect(new Set(headerNames)).toEqual(new Set(['Authorization']))
	})

	it('accounts for every migrated app and maps the live documentation route correctly', () => {
		const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
		for (const app of Object.keys(appMigrations)) expect(readme, app).toContain(`/apps/${app}`)
		expect(readme).toMatch(
			/Documentation server[^\n]+\/apps\/docs-ai-search[^\n]+docs\.mcp\.cloudflare\.com\/mcp/
		)
	})

	it('does not opt authenticated apps out of exact OAuth resource matching', () => {
		for (const app of Object.keys(appMigrations)) {
			const appDirectory = path.join(root, 'apps', app)
			const sourceDirectories = ['src', 'server']
				.map((directory) => path.join(appDirectory, directory))
				.filter((directory) => fs.existsSync(directory))
			for (const sourceDirectory of sourceDirectories) {
				for (const file of fs.readdirSync(sourceDirectory, { recursive: true, encoding: 'utf8' })) {
					if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue
					const source = fs.readFileSync(path.join(sourceDirectory, file), 'utf8')
					expect(source, `${app}/${file}`).not.toContain('resourceMatchOriginOnly')
				}
			}
		}
	})
})
