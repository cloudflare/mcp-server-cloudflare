import { DurableObject } from 'cloudflare:workers'
import JSZip from 'jszip'

import { Env } from './dex-analysis.context'

// Helper for reading large WARP diag zip archives.
// Holds the contents in memory between requests from the agent for specific files
// instead of having the worker download the zip on every request.
//
// Each DO represents one remote capture zip
export class WarpDiagReader extends DurableObject<Env> {
	#cache?: { files: string[]; zip: JSZip }

	// List the files in the zip for the agent
	async list(accessToken: string, url: string) {
		const { files } = await this.#getZip(accessToken, url)
		return files
	}

	// Return the contents of a file by path
	async read(accessToken: string, url: string, filepath: string) {
		const { zip } = await this.#getZip(accessToken, url)
		const file = zip.file(filepath)
		const content = await file?.async('text')
		return content
	}

	async #getZip(accessToken: string, url: string) {
		if (this.#cache) {
			return this.#cache
		}

		console.log(`WarpDiagReader fetching `, url)

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})

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

// Create unique name based on accessToken hash and download url. In order to read cached zip from memory
// you need to have the same access token that was used to fetch it.
async function readerName(accessToken: string, url: string) {
	return (await hashToken(accessToken)) + url
}

export async function getReader(env: Env, accessToken: string, download: string) {
	const name = await readerName(accessToken, download)
	const id = env.WARP_DIAG_READER.idFromName(name)
	return env.WARP_DIAG_READER.get(id)
}
