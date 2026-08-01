import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assignPorts, parseDotEnv } from './apps.mjs'

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
