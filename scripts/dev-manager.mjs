import fs from 'node:fs'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	APPS,
	APP_ENV_REQUIREMENTS,
	REQUIRED_ENV_VARS,
	assignPorts,
	createAppProcesses,
	parseDotEnv,
	findAvailablePort,
} from '../apps/dev-dashboard/src/apps.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.development.local')
const pnpmAvailable = spawnSync('pnpm', ['-v'], { stdio: 'ignore' }).status === 0
const pnpmRunner = pnpmAvailable ? ['pnpm', []] : ['corepack', ['pnpm']]

const args = process.argv.slice(2)
const getArg = (flag) => {
	const index = args.indexOf(flag)
	if (index === -1) return null
	return args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null
}

function ensureDependencies() {
	if (fs.existsSync(path.join(root, 'node_modules'))) return
	console.log('📦 node_modules not found, running pnpm install...')
	const [command, baseArgs] = pnpmRunner
	const result = spawnSync(command, [...baseArgs, 'install'], {
		cwd: root,
		stdio: 'inherit',
		env: process.env,
	})
	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}

function ensureEnvFile() {
	if (fs.existsSync(envPath)) return
	const result = spawnSync('node', ['scripts/setup-dev-environment.mjs'], {
		cwd: root,
		stdio: 'inherit',
		env: process.env,
	})
	if (result.status !== 0) process.exit(result.status ?? 1)
}

function loadEnv() {
	const values = {}
	if (!fs.existsSync(envPath)) return values
	Object.assign(values, parseDotEnv(fs.readFileSync(envPath, 'utf8')))
	return values
}

function listApps() {
	console.log('Available apps:')
	for (const app of APPS) {
		console.log(`- ${app.name} (default port ${app.defaultPort})`)
	}
}

if (args.includes('--list')) {
	listApps()
	process.exit(0)
}

const selectedApp = getArg('--app') ?? (args[0] && !args[0].startsWith('--') ? args[0] : null)
const chosenApps = selectedApp ? APPS.filter((app) => app.name === selectedApp) : APPS
if (selectedApp && chosenApps.length === 0) {
	console.error(`Unknown app: ${selectedApp}`)
	listApps()
	process.exit(1)
}

ensureDependencies()
ensureEnvFile()

const dotenvValues = loadEnv()
const mergedEnv = { ...process.env, ...dotenvValues }
const envStatus = REQUIRED_ENV_VARS.map((key) => ({ key, configured: Boolean(mergedEnv[key]) }))

const logBuffer = []
const sseClients = new Set()
const states = new Map()
const appChildren = new Map()
let isShuttingDown = false

function pushLog(app, stream, message) {
	const lines = message.split('\n').filter(Boolean)
	for (const line of lines) {
		const entry = {
			time: new Date().toISOString(),
			app,
			stream,
			line,
		}
		logBuffer.push(entry)
		if (logBuffer.length > 1000) logBuffer.shift()
		const payload = `data: ${JSON.stringify(entry)}\n\n`
		for (const client of sseClients) client.write(payload)
	}
}

function renderDashboardHtml() {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>MCP Dev Dashboard</title>
<style>
body { font-family: Arial, sans-serif; margin: 20px; background: #0b1220; color: #e2e8f0; }
a { color: #93c5fd; }
.card { border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #111827; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; }
.status-online { color: #34d399; }
.status-offline, .status-error { color: #f87171; }
.status-starting { color: #fbbf24; }
.status-stopped { color: #94a3b8; }
pre { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 10px; max-height: 360px; overflow: auto; }
button { margin-right: 8px; }
</style>
</head>
<body>
<h1>MCP Server Cloudflare - Unified Dev Dashboard</h1>
<p>Dashboard: <strong id="dashboard-port"></strong></p>
<h2>Environment</h2>
<div id="env"></div>
<h2>Apps</h2>
<div class="grid" id="apps"></div>
<h2>Live Logs</h2>
<pre id="logs"></pre>
<script>
const logs = document.getElementById('logs');
const dashboardPort = document.getElementById('dashboard-port');
const envContainer = document.getElementById('env');
const appsContainer = document.getElementById('apps');
function render(state) {
	dashboardPort.textContent = state.dashboardUrl;
	envContainer.innerHTML = state.envStatus.map(env => \`<div>\${env.configured ? '✅' : '⚠️'} <code>\${env.key}</code></div>\`).join('');
	appsContainer.innerHTML = state.apps.map(app => \`
		<div class="card">
			<h3>\${app.name}</h3>
			<div>\${app.description}</div>
			<div>Status: <span class="status-\${app.status}">\${app.status}</span></div>
			<div>Port: <strong>\${app.port}</strong>\${app.portChanged ? \` (reassigned from \${app.defaultPort})\` : ''}</div>
			<div>Tools/features: \${app.features.join(', ')}</div>
			<div>App env vars: \${app.envVars.length ? app.envVars.join(', ') : 'defaults only'}</div>
			<div><a href="\${app.baseUrl}" target="_blank">\${app.baseUrl}</a></div>
			<div><a href="\${app.mcpUrl}" target="_blank">\${app.mcpUrl}</a></div>
			<div style="margin-top:8px;">
				<button onclick="toggle('\${app.name}','start')">Start</button>
				<button onclick="toggle('\${app.name}','stop')">Stop</button>
			</div>
		</div>
	\`).join('');
}
async function refresh() {
	const response = await fetch('/api/state');
	render(await response.json());
}
async function toggle(name, action) {
	await fetch(\`/api/apps/\${name}/\${action}\`, { method: 'POST' });
	await refresh();
}
setInterval(refresh, 2000);
refresh();
const events = new EventSource('/api/logs');
events.onmessage = (event) => {
	const data = JSON.parse(event.data);
	logs.textContent += \`[\${data.time}] [\${data.app}] \${data.line}\\n\`;
	logs.scrollTop = logs.scrollHeight;
};
</script>
</body>
</html>`
}

const dashboardServer = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost')
	if (url.pathname === '/') {
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.end(renderDashboardHtml())
		return
	}

	if (url.pathname === '/api/state') {
		res.setHeader('Content-Type', 'application/json; charset=utf-8')
		res.end(JSON.stringify({
			dashboardUrl,
			envStatus,
			apps: Array.from(states.values()),
		}))
		return
	}

	if (url.pathname === '/api/logs') {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		})
		sseClients.add(res)
		for (const entry of logBuffer.slice(-200)) {
			res.write(`data: ${JSON.stringify(entry)}\n\n`)
		}
		req.on('close', () => sseClients.delete(res))
		return
	}

	const actionMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/(start|stop)$/)
	if (actionMatch && req.method === 'POST') {
		const [, appName, action] = actionMatch
		const app = allocatedApps.find((entry) => entry.name === appName)
		if (!app) {
			res.statusCode = 404
			res.end('app not found')
			return
		}
		if (action === 'start') await startApp(app)
		if (action === 'stop') await stopApp(app.name)
		res.end('ok')
		return
	}

	res.statusCode = 404
	res.end('not found')
})

const allocatedApps = await assignPorts(chosenApps)
const dashboardPort = await findAvailablePort(Number(mergedEnv.DEV_DASHBOARD_PORT ?? 8780), new Set(allocatedApps.map((app) => app.port)))
const dashboardUrl = `http://127.0.0.1:${dashboardPort}`

for (const app of allocatedApps) {
	states.set(app.name, {
		name: app.name,
		description: app.description,
		features: app.features,
		envVars: APP_ENV_REQUIREMENTS[app.name] ?? [],
		defaultPort: app.defaultPort,
		port: app.port,
		portChanged: app.portChanged,
		baseUrl: `http://127.0.0.1:${app.port}`,
		mcpUrl: `http://127.0.0.1:${app.port}/mcp`,
		status: 'stopped',
	})
}

function spawnProcess(appName, command, commandArgs, index = 0) {
	let finalCommand = command
	let finalArgs = commandArgs
	if (command === 'pnpm') {
		finalCommand = pnpmRunner[0]
		finalArgs = [...pnpmRunner[1], ...commandArgs]
	}
	const label = index > 0 ? `${appName}#${index + 1}` : appName
	const child = spawn(finalCommand, finalArgs, {
		cwd: root,
		env: mergedEnv,
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	child.stdout.on('data', (data) => pushLog(label, 'stdout', String(data)))
	child.stderr.on('data', (data) => pushLog(label, 'stderr', String(data)))
	child.on('exit', (code, signal) => {
		if (!isShuttingDown) {
			pushLog(label, 'stderr', `process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
		}
		const current = states.get(appName)
		if (current && current.status !== 'stopped') {
			states.set(appName, { ...current, status: code === 0 || isShuttingDown ? 'stopped' : 'error' })
		}
	})
	return child
}

async function startApp(app) {
	const existing = appChildren.get(app.name)
	if (existing && existing.some((proc) => proc.exitCode === null)) return
	const state = states.get(app.name)
	if (state) states.set(app.name, { ...state, status: 'starting' })

	const commands = createAppProcesses(app, app.port, { wranglerDevMode: 'local' })
	const children = commands.map(([command, commandArgs], index) => spawnProcess(app.name, command, commandArgs, index))
	appChildren.set(app.name, children)
}

async function stopApp(appName) {
	const children = appChildren.get(appName)
	if (!children) return
	for (const child of children) {
		if (!child.killed) child.kill('SIGTERM')
	}
	appChildren.delete(appName)
	const state = states.get(appName)
	if (state) states.set(appName, { ...state, status: 'stopped' })
}

async function probeApp(app) {
	const current = states.get(app.name)
	if (!current) return
	const children = appChildren.get(app.name) ?? []
	if (children.length === 0) return
	const allExited = children.every((proc) => proc.exitCode !== null)
	if (allExited) return

	const probe = await new Promise((resolve) => {
		const request = http.get(`${current.mcpUrl}`, { timeout: 1000 }, (response) => {
			response.resume()
			resolve(response.statusCode !== undefined && response.statusCode < 500)
		})
		request.on('error', () => resolve(false))
		request.on('timeout', () => {
			request.destroy()
			resolve(false)
		})
	})

	states.set(app.name, { ...current, status: probe ? 'online' : 'offline' })
}

async function startAllApps() {
	console.log('Starting MCP apps:')
	for (const app of allocatedApps) {
		console.log(`- ${app.name} -> http://127.0.0.1:${app.port}/mcp${app.portChanged ? ` (reassigned from ${app.defaultPort})` : ''}`)
		await startApp(app)
	}
}

async function shutdown() {
	if (isShuttingDown) return
	isShuttingDown = true
	console.log('\nShutting down all dev processes...')
	for (const app of allocatedApps) {
		await stopApp(app.name)
	}
	dashboardServer.close()
	for (const client of sseClients) client.end()
	setTimeout(() => process.exit(0), 100)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await new Promise((resolve, reject) => {
	dashboardServer.listen(dashboardPort, '127.0.0.1', () => resolve())
	dashboardServer.on('error', reject)
})

console.log(`Unified dashboard available at ${dashboardUrl}`)
console.log('Environment status:')
for (const item of envStatus) {
	console.log(`- ${item.key}: ${item.configured ? 'configured' : 'missing'}`)
}

await startAllApps()

setInterval(async () => {
	for (const app of allocatedApps) {
		await probeApp(app)
	}
}, 2000)
