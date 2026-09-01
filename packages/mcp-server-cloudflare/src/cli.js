#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'

import { getAccountId, handleListRequest, normalizeLegacyResponse } from './proxy.js'

const require = createRequire(import.meta.url)
const legacyEntrypoint = require.resolve('mcp-server-cloudflare-legacy')
const argv = process.argv.slice(2)
const credentials = {
	accountId: getAccountId(argv, process.env),
	apiToken: process.env.CLOUDFLARE_API_TOKEN,
}

const child = spawn(process.execPath, [legacyEntrypoint, ...argv], {
	env: process.env,
	stdio: ['pipe', 'pipe', 'inherit'],
})

const clientInput = createInterface({ input: process.stdin, terminal: false })
const legacyOutput = createInterface({ input: child.stdout, terminal: false })

clientInput.on('line', async (line) => {
	let request
	try {
		request = JSON.parse(line)
	} catch {
		child.stdin.write(`${line}\n`)
		return
	}

	const response = await handleListRequest(request, credentials)
	if (response) {
		writeMessage(response)
	} else {
		child.stdin.write(`${line}\n`)
	}
})

clientInput.on('close', () => child.stdin.end())

legacyOutput.on('line', (line) => {
	try {
		writeMessage(normalizeLegacyResponse(JSON.parse(line)))
	} catch {
		process.stdout.write(`${line}\n`)
	}
})

child.on('error', (error) => {
	console.error(`Failed to start the legacy MCP server: ${error.message}`)
	process.exitCode = 1
})

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal)
	} else {
		process.exitCode = code ?? 1
	}
})

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => child.kill(signal))
}

function writeMessage(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`)
}
