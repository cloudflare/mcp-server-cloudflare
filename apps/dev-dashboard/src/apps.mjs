import net from 'node:net'

export const REQUIRED_ENV_VARS = [
	'CLOUDFLARE_ACCOUNT_ID',
	'CLOUDFLARE_API_TOKEN',
	'CLOUDFLARE_EMAIL',
	'CLOUDFLARE_CLIENT_ID',
	'CLOUDFLARE_CLIENT_SECRET',
	'MCP_SERVER_NAME',
	'MCP_SERVER_VERSION',
]

export const APP_ENV_REQUIREMENTS = {
	'ai-gateway': ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	auditlogs: ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	autorag: ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	'browser-rendering': ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	'cloudflare-blog': ['BLOG_BASE_URL', 'SEARCH_BASE_URL'],
	'cloudflare-one-casb': ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET'],
	graphql: ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	logpush: ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
	'sandbox-container': [
		'CLOUDFLARE_CLIENT_ID',
		'CLOUDFLARE_CLIENT_SECRET',
		'MCP_SERVER_NAME',
		'MCP_SERVER_VERSION',
		'CONTAINER_MANAGER',
		'USER_CONTAINER',
	],
	'workers-bindings': ['CLOUDFLARE_CLIENT_ID', 'CLOUDFLARE_CLIENT_SECRET', 'MCP_SERVER_NAME', 'MCP_SERVER_VERSION'],
}

export const APPS = [
	{
		name: 'docs-ai-search',
		description: 'Get up-to-date reference information on Cloudflare',
		features: ['Cloudflare docs search', 'Reference lookups'],
		command: ['pnpm', ['--dir', 'apps/docs-ai-search', 'exec', 'wrangler', 'dev']],
		defaultPort: 8801,
	},
	{
		name: 'workers-bindings',
		description: 'Build Workers applications with storage, AI, and compute primitives',
		features: ['Workers bindings guidance', 'Storage + AI primitives'],
		command: ['pnpm', ['--dir', 'apps/workers-bindings', 'exec', 'wrangler', 'dev']],
		defaultPort: 8802,
	},
	{
		name: 'workers-builds',
		description: 'Get insights and manage your Cloudflare Workers Builds',
		features: ['Build history', 'Build status and diagnostics'],
		command: ['pnpm', ['--dir', 'apps/workers-builds', 'dev', '--']],
		defaultPort: 8803,
		portFlag: '--port',
	},
	{
		name: 'workers-observability',
		description: "Debug and inspect your application's logs and analytics",
		features: ['Logs analytics', 'Application observability'],
		command: ['pnpm', ['--dir', 'apps/workers-observability', 'exec', 'wrangler', 'dev']],
		defaultPort: 8804,
	},
	{
		name: 'sandbox-container',
		description: 'Spin up a sandbox development environment',
		features: ['Ephemeral sandbox', 'Container-backed tool execution'],
		multiCommand: [
			['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'tsx', 'container/sandbox.container.app.ts']],
			['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'wrangler', 'dev', '--var', 'ENVIRONMENT:dev']],
		],
		defaultPort: 8805,
	},
	{
		name: 'browser-rendering',
		description: 'Fetch web pages, convert to markdown, and take screenshots',
		features: ['Web fetch', 'Screenshots and rendering'],
		command: ['pnpm', ['--dir', 'apps/browser-rendering', 'exec', 'wrangler', 'dev']],
		defaultPort: 8806,
	},
	{
		name: 'logpush',
		description: 'Get quick summaries for Logpush job health',
		features: ['Logpush health checks', 'Job summaries'],
		command: ['pnpm', ['--dir', 'apps/logpush', 'exec', 'wrangler', 'dev']],
		defaultPort: 8807,
	},
	{
		name: 'ai-gateway',
		description: 'Search logs and inspect prompts/responses',
		features: ['Prompt analytics', 'Gateway usage inspection'],
		command: ['pnpm', ['--dir', 'apps/ai-gateway', 'exec', 'wrangler', 'dev']],
		defaultPort: 8808,
	},
	{
		name: 'autorag',
		description: 'Search and query account AutoRAG instances',
		features: ['AutoRAG discovery', 'AutoRAG query tools'],
		command: ['pnpm', ['--dir', 'apps/autorag', 'exec', 'wrangler', 'dev']],
		defaultPort: 8809,
	},
	{
		name: 'auditlogs',
		description: 'Query audit logs and generate review reports',
		features: ['Audit log queries', 'Compliance report support'],
		command: ['pnpm', ['--dir', 'apps/auditlogs', 'exec', 'wrangler', 'dev']],
		defaultPort: 8810,
	},
	{
		name: 'dns-analytics',
		description: 'Optimize DNS performance and debug setup issues',
		features: ['DNS analytics', 'Performance diagnostics'],
		command: ['pnpm', ['--dir', 'apps/dns-analytics', 'exec', 'wrangler', 'dev']],
		defaultPort: 8811,
	},
	{
		name: 'dex-analysis',
		description: 'Insights on critical application user experience',
		features: ['Digital experience insights', 'Application health trends'],
		command: ['pnpm', ['--dir', 'apps/dex-analysis', 'exec', 'wrangler', 'dev']],
		defaultPort: 8812,
	},
	{
		name: 'cloudflare-one-casb',
		description: 'Identify SaaS security misconfigurations',
		features: ['CASB posture checks', 'SaaS security insights'],
		command: ['pnpm', ['--dir', 'apps/cloudflare-one-casb', 'exec', 'wrangler', 'dev']],
		defaultPort: 8813,
	},
	{
		name: 'radar',
		description: 'Explore Cloudflare Radar internet insights',
		features: ['Internet trend data', 'Radar analytics'],
		command: ['pnpm', ['--dir', 'apps/radar', 'exec', 'wrangler', 'dev']],
		defaultPort: 8814,
	},
	{
		name: 'cloudflare-blog',
		description: 'Search and read Cloudflare Blog posts',
		features: ['Blog search', 'Article retrieval'],
		command: ['pnpm', ['--dir', 'apps/cloudflare-blog', 'exec', 'wrangler', 'dev']],
		defaultPort: 8815,
	},
	{
		name: 'demo-day',
		description: 'Demonstrate a minimal Cloudflare MCP server',
		features: ['Minimal MCP example', 'Local demo workflows'],
		command: ['pnpm', ['--dir', 'apps/demo-day', 'exec', 'wrangler', 'dev']],
		defaultPort: 8816,
	},
	{
		name: 'graphql',
		description: 'Cloudflare GraphQL analytics access',
		features: ['GraphQL analytics tools', 'Query assistance'],
		command: ['pnpm', ['--dir', 'apps/graphql', 'exec', 'wrangler', 'dev']],
		defaultPort: 8817,
	},
	{
		name: 'stack-mcp',
		description: 'Unified tool access across Cloudflare product domains',
		features: ['Unified MCP surface', 'Cross-domain tools'],
		command: ['pnpm', ['--dir', 'apps/stack-mcp', 'exec', 'wrangler', 'dev']],
		defaultPort: 8818,
	},
]

export function parseDotEnv(content) {
	const output = {}
	for (const rawLine of content.split('\n')) {
		const line = rawLine.trim()
		if (!line || line.startsWith('#')) continue
		const index = line.indexOf('=')
		if (index <= 0) continue
		const key = line.slice(0, index).trim()
		let value = line.slice(index + 1).trim()
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1)
		}
		output[key] = value
	}
	return output
}

export function createAppProcesses(app, port) {
	const commands = app.multiCommand ?? [app.command]
	return commands.map((entry, index) => {
		const [command, args] = entry
		const baseArgs = [...args]
		if (command === 'pnpm') {
			if (app.name === 'workers-builds') {
				baseArgs.push('--port', String(port), '--strictPort')
			} else if (app.name === 'sandbox-container') {
				if (index === 1) baseArgs.push('--port', String(port))
			} else {
				baseArgs.push('--port', String(port))
			}
		}
		return [command, baseArgs]
	})
}

export async function isPortAvailable(port) {
	return new Promise((resolve) => {
		const server = net.createServer()
		server.once('error', () => resolve(false))
		server.once('listening', () => {
			server.close(() => resolve(true))
		})
		server.listen(port, '127.0.0.1')
	})
}

export async function findAvailablePort(startPort, used = new Set(), checker = isPortAvailable) {
	let port = startPort
	while (used.has(port) || !(await checker(port))) {
		port += 1
	}
	used.add(port)
	return port
}

export async function assignPorts(apps, checker = isPortAvailable) {
	const used = new Set()
	const result = []
	for (const app of apps) {
		const actualPort = await findAvailablePort(app.defaultPort, used, checker)
		result.push({
			...app,
			port: actualPort,
			portChanged: actualPort !== app.defaultPort,
		})
	}
	return result
}
