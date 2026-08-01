import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assignPorts, createAppProcesses, parseDotEnv } from './apps.mjs'

describe('assignPorts', () => {
	it('allocates unique ports and bumps occupied ports', async () => {
		const portsInUse = new Set([9000, 9001])
		const checker = async (port) => !portsInUse.has(port)
		const apps = [
			{ name: 'a', defaultPort: 9000 },
			{ name: 'b', defaultPort: 9001 },
			{ name: 'c', defaultPort: 9002 },
		]

		const assigned = await assignPorts(apps, checker)
		assert.deepEqual(assigned.map((app) => app.port), [9002, 9003, 9004])
		assert.deepEqual(assigned.map((app) => app.portChanged), [true, true, true])
	})
})

describe('parseDotEnv', () => {
	it('parses key/value pairs and strips optional quotes', () => {
		const env = parseDotEnv("A=1\nB='two'\nC=\"three\"\n# ignored\n")
		assert.deepEqual(env, { A: '1', B: 'two', C: 'three' })
	})
})

describe('createAppProcesses', () => {
<<<<<<< HEAD
	it('uses per-process metadata for port and local wrangler args', () => {
		const app = {
			name: 'sandbox-container',
			multiCommand: [
				['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'tsx', 'container/sandbox.container.app.ts']],
				['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'wrangler', 'dev', '--var', 'ENVIRONMENT:dev']],
			],
			processOptions: [{}, { appendPort: true, supportsLocalWranglerDev: true }],
		}

		assert.deepEqual(createAppProcesses(app, 8805, { wranglerDevMode: 'local' }), [
			['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'tsx', 'container/sandbox.container.app.ts']],
			['pnpm', ['--dir', 'apps/sandbox-container', 'exec', 'wrangler', 'dev', '--var', 'ENVIRONMENT:dev', '--port', '8805', '--local']],
		])
	})

	it('supports strict port injection without wrangler-local args', () => {
		const app = {
			name: 'workers-builds',
			command: ['pnpm', ['--dir', 'apps/workers-builds', 'dev', '--']],
			processOptions: [{ appendPort: true, strictPort: true }],
		}

		assert.deepEqual(createAppProcesses(app, 8803, { wranglerDevMode: 'local' }), [
			['pnpm', ['--dir', 'apps/workers-builds', 'dev', '--', '--port', '8803', '--strictPort']],
		])
	})

	it('rejects unsupported options', () => {
		assert.throws(() => createAppProcesses({ command: ['pnpm', []] }, 8801, { useMiniflare: true }), {
			name: 'TypeError',
			message: 'Unsupported createAppProcesses options: useMiniflare',
		})
=======
	it('adds --local for wrangler dev commands in miniflare mode', () => {
		const app = {
			name: 'ai-gateway',
			command: ['pnpm', ['--dir', 'apps/ai-gateway', 'exec', 'wrangler', 'dev']],
		}
		const commands = createAppProcesses(app, 8810, { useMiniflare: true })
		assert.equal(commands[0][1].includes('--local'), true)
	})

	it('does not add --local for non-wrangler commands in miniflare mode', () => {
		const app = {
			name: 'workers-builds',
			command: ['pnpm', ['--dir', 'apps/workers-builds', 'dev', '--']],
		}
		const commands = createAppProcesses(app, 8811, { useMiniflare: true })
		assert.equal(commands[0][1].includes('--local'), false)
>>>>>>> origin/main
	})
})
