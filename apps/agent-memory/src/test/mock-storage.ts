/**
 * Mock R2Storage for testing
 * In-memory storage that implements the R2Storage interface
 */

import type { R2Storage } from '../storage/r2'
import type { MemoryFile, MemoryFileMetadata } from '../types'

interface StoredFile {
	content: string
	updated_at: string
}

/**
 * Deterministic content-derived stand-in for R2's md5 etag. Not a real
 * md5 — the mock has no crypto dependency and no test asserts the exact
 * value; it only needs to be stable per content so etag-diffing logic
 * behaves. Real R2 returns md5 hex here.
 */
function fakeEtag(content: string): string {
	let h = 0
	for (let i = 0; i < content.length; i++) {
		h = (Math.imul(31, h) + content.charCodeAt(i)) | 0
	}
	return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Create a mock R2Storage backed by a Map
 */
export function createMockStorage(): R2Storage & {
	_files: Map<string, StoredFile>
	_clear: () => void
} {
	const files = new Map<string, StoredFile>()

	return {
		_files: files,
		_clear: () => files.clear(),

		async read(path: string): Promise<MemoryFile | null> {
			const file = files.get(path)
			if (!file) return null
			return {
				path,
				content: file.content,
				updated_at: file.updated_at,
				size: file.content.length,
			}
		},

		async write(path: string, content: string): Promise<{ version_id?: string }> {
			files.set(path, {
				content,
				updated_at: new Date().toISOString(),
			})
			return { version_id: `v-${Date.now()}` }
		},

		async list(prefix = '', recursive = false): Promise<MemoryFileMetadata[]> {
			const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : ''
			const results: MemoryFileMetadata[] = []
			const seenDirs = new Set<string>()

			for (const [path, file] of files.entries()) {
				if (!path.startsWith(normalizedPrefix)) continue

				if (recursive) {
					results.push({
						path,
						size: file.content.length,
						updated_at: file.updated_at,
						etag: fakeEtag(file.content),
					})
				} else {
					// Non-recursive: only show direct children
					const relativePath = path.slice(normalizedPrefix.length)
					const slashIndex = relativePath.indexOf('/')

					if (slashIndex === -1) {
						// Direct file
						results.push({
							path,
							size: file.content.length,
							updated_at: file.updated_at,
							etag: fakeEtag(file.content),
						})
					} else {
						// Directory
						const dir = normalizedPrefix + relativePath.slice(0, slashIndex + 1)
						if (!seenDirs.has(dir)) {
							seenDirs.add(dir)
							results.push({
								path: dir,
								size: 0,
								updated_at: new Date().toISOString(),
							})
						}
					}
				}
			}

			return results
		},

		async delete(path: string): Promise<void> {
			files.delete(path)
		},
	}
}
