import { DurableObject } from 'cloudflare:workers'
import JSZip from 'jszip'

import { getEnv } from '@repo/mcp-common/src/env'

import { type Env } from './dex-analysis.context'

const env = getEnv<Env>()

// Helper for reading large WARP diag zip archives.
// Holds the contents in memory between requests from the agent for specific files
// instead of having the worker download the zip on every request.
//
// Each DO represents one remote capture zip
export class WarpDiagReader extends DurableObject<Env> {
	#cache?: { files: string[]; zip: JSZip }

	// List the files in the zip for the agent
	async list({
		accessToken,
		accountId,
		deviceId,
		commandId,
	}: {
		accessToken: string
		accountId: string
		deviceId: string
		commandId: string
	}) {
		const { files } = await this.#getZip({ accessToken, accountId, deviceId, commandId })
		return files
	}

	// Return the contents of a file by path
	async read({
		accessToken,
		accountId,
		deviceId,
		commandId,
		filepath,
	}: {
		accessToken: string
		accountId: string
		deviceId: string
		commandId: string
		filepath: string
	}) {
		const { zip } = await this.#getZip({ accessToken, accountId, deviceId, commandId })
		const file = zip.file(filepath)
		const content = await file?.async('text')
		return content
	}

	async #getZip({
		accessToken,
		accountId,
		deviceId,
		commandId,
	}: {
		accessToken: string
		accountId: string
		deviceId: string
		commandId: string
	}) {
		if (this.#cache) {
			return this.#cache
		}

		const url = new URL(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/dex/devices/${deviceId}/commands/downloads/${commandId}.zip`
		)

		let headers = {
			Authorization: `Bearer ${accessToken}`,
		}

		if (env.DEV_DISABLE_OAUTH) {
			headers = {
				Authorization: `Bearer ${env.DEV_CLOUDFLARE_API_TOKEN}`,
			}
		}

		const res = await fetch(url, { headers })

		if (res.status !== 200) {
			throw new Error(`failed to download zip, non-200 status code: ${res.status}`)
		}

		const zip = await new JSZip().loadAsync(await res.arrayBuffer())
		const files: string[] = []
		for (const [relativePath, file] of Object.entries(zip.files)) {
			if (!file.dir) {
				files.push(relativePath)
			}
		}

		const cache = { files, zip }
		this.#cache = cache
		return cache
	}
}

async function hashToken(accessToken: string) {
	const hashArr = Array.from(
		new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken)))
	)
	return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Create unique name based on accessToken hash and the download details. In order to read cached zip from memory
// you need to have the same access token that was used to fetch it.
async function readerName({
	accessToken,
	deviceId,
	commandId,
}: {
	accessToken: string
	deviceId: string
	commandId: string
}) {
	return (await hashToken(accessToken)) + deviceId + commandId
}

export async function getReader({
	accessToken,
	deviceId,
	commandId,
}: {
	accessToken: string
	deviceId: string
	commandId: string
}) {
	const name = await readerName({ accessToken, deviceId, commandId })
	const id = env.WARP_DIAG_READER.idFromName(name)
	return env.WARP_DIAG_READER.get(id)
}
