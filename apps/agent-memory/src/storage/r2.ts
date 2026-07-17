import type { CloudflareCredentials } from '../ai/runner'
import type { FileVersion, MemoryFile, MemoryFileMetadata } from '../types'

/**
 * Storage abstraction for memory files.
 *
 * The implementation ({@link createRestR2Storage}) talks to R2 via the
 * Cloudflare REST object API, scoped to the *user's* account with their
 * OAuth token. Every user's files live in a bucket in their own account, so
 * R2 storage + operations spend is billed to the user, not to the account
 * hosting this MCP server.
 */
export interface R2Storage {
	read(path: string): Promise<MemoryFile | null>
	write(path: string, content: string): Promise<{ version_id?: string }>
	list(path?: string, recursive?: boolean): Promise<MemoryFileMetadata[]>
	delete(path: string): Promise<void>
	getVersions(path: string, limit?: number): Promise<FileVersion[]>
	getVersion(path: string, versionId: string): Promise<string | null>
}

const API_BASE = 'https://api.cloudflare.com/client/v4'

interface ListObjectsResponse {
	result?: Array<{ key: string; size: number; etag?: string; last_modified?: string }>
	result_info?: { cursor?: string; is_truncated?: boolean; delimited?: string[] }
	success: boolean
	errors?: Array<{ message: string }>
}

/**
 * R2 storage backed by the Cloudflare REST object API, scoped to one user's
 * account. The bucket is created lazily and idempotently on first write.
 */
export function createRestR2Storage(creds: CloudflareCredentials, bucketName: string): R2Storage {
	const bucketBase = `${API_BASE}/accounts/${creds.accountId}/r2/buckets/${encodeURIComponent(bucketName)}`
	const authHeaders = (): Record<string, string> => ({
		Authorization: `Bearer ${creds.apiToken}`,
	})

	// Keys can contain slashes that form the memory hierarchy; preserve them,
	// but encode each segment so spaces / unusual characters are safe.
	const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/')

	let bucketEnsured = false
	async function ensureBucket(): Promise<void> {
		if (bucketEnsured) return
		const res = await fetch(`${API_BASE}/accounts/${creds.accountId}/r2/buckets`, {
			method: 'POST',
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: bucketName }),
		})
		// 200 = created, or already exists (10004 / 409). Anything else is fatal.
		if (res.ok) {
			bucketEnsured = true
			return
		}
		const text = await res.text()
		if (res.status === 409 || text.includes('already') || text.includes('10004')) {
			bucketEnsured = true
			return
		}
		throw new Error(`Failed to ensure R2 bucket "${bucketName}" (${res.status}): ${text}`)
	}

	return {
		async read(path: string): Promise<MemoryFile | null> {
			const res = await fetch(`${bucketBase}/objects/${encodeKey(path)}`, {
				headers: authHeaders(),
			})
			if (res.status === 404) return null
			if (!res.ok) {
				throw new Error(`R2 get "${path}" failed (${res.status}): ${await res.text()}`)
			}
			const content = await res.text()
			const lastModified = res.headers.get('last-modified')
			return {
				path,
				content,
				updated_at: lastModified ? new Date(lastModified).toISOString() : new Date().toISOString(),
				size: content.length,
			}
		},

		async write(path: string, content: string): Promise<{ version_id?: string }> {
			await ensureBucket()
			const res = await fetch(`${bucketBase}/objects/${encodeKey(path)}`, {
				method: 'PUT',
				headers: { ...authHeaders(), 'Content-Type': 'application/octet-stream' },
				body: content,
			})
			if (!res.ok) {
				throw new Error(`R2 put "${path}" failed (${res.status}): ${await res.text()}`)
			}
			return { version_id: res.headers.get('etag') ?? undefined }
		},

		async list(path = '', recursive = false): Promise<MemoryFileMetadata[]> {
			await ensureBucket()
			const prefix = path ? (path.endsWith('/') ? path : `${path}/`) : ''
			const files: MemoryFileMetadata[] = []
			const prefixes = new Set<string>()
			let cursor: string | undefined

			do {
				const params = new URLSearchParams({ per_page: '1000' })
				if (prefix) params.set('prefix', prefix)
				if (!recursive) params.set('delimiter', '/')
				if (cursor) params.set('cursor', cursor)

				const res = await fetch(`${bucketBase}/objects?${params.toString()}`, {
					headers: authHeaders(),
				})
				if (!res.ok) {
					throw new Error(`R2 list "${prefix}" failed (${res.status}): ${await res.text()}`)
				}
				const json = (await res.json()) as ListObjectsResponse

				for (const obj of json.result ?? []) {
					files.push({
						path: obj.key,
						size: obj.size,
						updated_at: obj.last_modified
							? new Date(obj.last_modified).toISOString()
							: new Date().toISOString(),
						etag: obj.etag?.replace(/"/g, ''),
					})
				}
				for (const p of json.result_info?.delimited ?? []) {
					prefixes.add(p)
				}

				cursor = json.result_info?.is_truncated ? json.result_info?.cursor : undefined
			} while (cursor)

			// Include "directories" from delimited prefixes.
			for (const p of prefixes) {
				files.push({ path: p, size: 0, updated_at: new Date().toISOString() })
			}

			return files
		},

		async delete(path: string): Promise<void> {
			const res = await fetch(`${bucketBase}/objects/${encodeKey(path)}`, {
				method: 'DELETE',
				headers: authHeaders(),
			})
			if (!res.ok && res.status !== 404) {
				throw new Error(`R2 delete "${path}" failed (${res.status}): ${await res.text()}`)
			}
		},

		// Object versioning is not exposed through the REST object API, so
		// history/rollback degrade gracefully to "no versions". The tool
		// surface documents this. (Kept on the interface for parity with the
		// self-hosted binding-based implementation.)
		async getVersions(_path: string, _limit = 10): Promise<FileVersion[]> {
			return []
		},

		async getVersion(_path: string, _versionId: string): Promise<string | null> {
			return null
		},
	}
}
