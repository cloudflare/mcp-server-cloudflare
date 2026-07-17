import type { CloudflareCredentials } from '../ai/runner'
import type { MemoryFile, MemoryFileMetadata } from '../types'

/**
 * Storage abstraction for account-scoped memory files.
 *
 * The implementation ({@link createRestR2Storage}) talks to R2 through the
 * Cloudflare REST API with the selected account and the caller's OAuth token.
 */
export interface R2Storage {
	read(path: string): Promise<MemoryFile | null>
	write(path: string, content: string): Promise<{ version_id?: string }>
	list(path?: string, recursive?: boolean): Promise<MemoryFileMetadata[]>
	delete(path: string): Promise<void>
}

const API_BASE = 'https://api.cloudflare.com/client/v4'
const MAX_PATH_LENGTH = 1024
const MAX_OBJECT_READ_BYTES = 5_000_000
const MAX_LIST_RESULTS = 1_000

const MANAGED_PATH_PREFIXES = [
	'.mcp/',
	'conversations/',
	'reminders/',
	'memory/meta/',
	'memory/reflections/',
] as const

interface ListObjectsResponse {
	result?: Array<{ key: string; size: number; etag?: string; last_modified?: string }>
	result_info?: { cursor?: string; is_truncated?: boolean; delimited?: string[] }
	success: boolean
	errors?: Array<{ message: string }>
}

interface PutObjectResponse {
	result?: { etag?: string; version?: string }
	success?: boolean
	errors?: Array<{ message?: string }>
}

/**
 * Validate a memory path before interpolating it into the R2 object URL.
 *
 * `URL` normalizes literal `.` and `..` path segments. Without this guard a
 * key such as `../../other-bucket/objects/key` escapes the configured bucket
 * before the request is sent. Empty segments and backslashes are rejected as
 * well so every accepted key has one unambiguous representation.
 */
export function isManagedMemoryPath(path: string): boolean {
	return MANAGED_PATH_PREFIXES.some(
		(prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix)
	)
}

export function isSecretMemoryPath(path: string): boolean {
	return ['.mcp', 'conversations', 'reminders', 'memory/meta'].some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`)
	)
}

export function validateMemoryPath(path: string, options: { allowRoot?: boolean } = {}): string {
	if (options.allowRoot && path === '') return ''
	if (!path || path.length > MAX_PATH_LENGTH) {
		throw new Error(`Invalid memory path: path must be 1-${MAX_PATH_LENGTH} characters`)
	}
	if (path.startsWith('/') || path.endsWith('/') || path.includes('\\')) {
		throw new Error('Invalid memory path: use a relative path with forward slashes')
	}
	if (
		[...path].some((character) => {
			const code = character.charCodeAt(0)
			return code <= 31 || code === 127
		})
	) {
		throw new Error('Invalid memory path: control characters are not allowed')
	}
	const segments = path.split('/')
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
		throw new Error('Invalid memory path: empty, ".", and ".." segments are not allowed')
	}
	return path
}

function encodeKey(path: string): string {
	return validateMemoryPath(path).split('/').map(encodeURIComponent).join('/')
}

async function readObjectText(response: Response): Promise<string> {
	const declaredLength = response.headers.get('content-length')
	if (declaredLength && Number(declaredLength) > MAX_OBJECT_READ_BYTES) {
		throw new Error(`R2 object exceeds the ${MAX_OBJECT_READ_BYTES}-byte read limit`)
	}
	if (!response.body) return ''

	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let bytes = 0
	let text = ''
	let chunk = await reader.read()
	while (!chunk.done) {
		bytes += chunk.value.byteLength
		if (bytes > MAX_OBJECT_READ_BYTES) {
			await reader.cancel()
			throw new Error(`R2 object exceeds the ${MAX_OBJECT_READ_BYTES}-byte read limit`)
		}
		text += decoder.decode(chunk.value, { stream: true })
		chunk = await reader.read()
	}
	return text + decoder.decode()
}

/**
 * R2 storage backed by the Cloudflare REST object API for one account.
 * The bucket is created lazily when a write/list first observes it missing.
 */
export function createRestR2Storage(creds: CloudflareCredentials, bucketName: string): R2Storage {
	const accountBase = `${API_BASE}/accounts/${encodeURIComponent(creds.accountId)}/r2/buckets`
	const bucketBase = `${accountBase}/${encodeURIComponent(bucketName)}`
	const authHeaders = (): Record<string, string> => ({
		Authorization: `Bearer ${creds.apiToken}`,
	})

	// A write_many call can discover a missing bucket from several parallel
	// PUTs. Share the create request so only one bucket-create call is issued.
	let ensureBucketPromise: Promise<void> | undefined
	async function ensureBucket(): Promise<void> {
		if (!ensureBucketPromise) {
			ensureBucketPromise = (async () => {
				const res = await fetch(accountBase, {
					method: 'POST',
					headers: { ...authHeaders(), 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: bucketName }),
				})
				if (res.ok) return

				const text = await res.text()
				// R2 may report an existing bucket as 409 or API error 10004.
				if (res.status === 409 || /"code"\s*:\s*10004/.test(text)) return
				throw new Error(`Failed to create R2 bucket "${bucketName}" (${res.status}): ${text}`)
			})()
		}

		try {
			await ensureBucketPromise
		} catch (error) {
			ensureBucketPromise = undefined
			throw error
		}
	}

	async function putObject(path: string, content: string): Promise<Response> {
		return fetch(`${bucketBase}/objects/${encodeKey(path)}`, {
			method: 'PUT',
			headers: { ...authHeaders(), 'Content-Type': 'application/octet-stream' },
			body: content,
		})
	}

	async function listObjects(params: URLSearchParams): Promise<Response> {
		return fetch(`${bucketBase}/objects?${params.toString()}`, { headers: authHeaders() })
	}

	return {
		async read(path: string): Promise<MemoryFile | null> {
			const safePath = validateMemoryPath(path)
			const res = await fetch(`${bucketBase}/objects/${encodeKey(safePath)}`, {
				headers: authHeaders(),
			})
			if (res.status === 404) return null
			if (!res.ok) {
				throw new Error(`R2 get "${safePath}" failed (${res.status}): ${await res.text()}`)
			}
			const content = await readObjectText(res)
			const lastModified = res.headers.get('last-modified')
			const contentLengthHeader = res.headers.get('content-length')
			const contentLength = contentLengthHeader === null ? undefined : Number(contentLengthHeader)
			return {
				path: safePath,
				content,
				updated_at: lastModified ? new Date(lastModified).toISOString() : new Date().toISOString(),
				size:
					contentLength !== undefined && Number.isFinite(contentLength)
						? contentLength
						: new TextEncoder().encode(content).byteLength,
			}
		},

		async write(path: string, content: string): Promise<{ version_id?: string }> {
			const safePath = validateMemoryPath(path)
			if (new TextEncoder().encode(content).byteLength > MAX_OBJECT_READ_BYTES) {
				throw new Error(`R2 object exceeds the ${MAX_OBJECT_READ_BYTES}-byte write limit`)
			}
			let res = await putObject(safePath, content)
			if (res.status === 404) {
				await ensureBucket()
				res = await putObject(safePath, content)
			}
			if (!res.ok) {
				throw new Error(`R2 put "${safePath}" failed (${res.status}): ${await res.text()}`)
			}

			let result: PutObjectResponse | undefined
			if (res.headers.get('content-type')?.includes('application/json')) {
				result = (await res.json()) as PutObjectResponse
				if (result.success === false) {
					throw new Error(
						`R2 put "${safePath}" failed: ${result.errors?.map((error) => error.message).join(', ') || 'unknown API error'}`
					)
				}
			}
			return {
				version_id:
					result?.result?.version ?? result?.result?.etag ?? res.headers.get('etag') ?? undefined,
			}
		},

		async list(path = '', recursive = false): Promise<MemoryFileMetadata[]> {
			if (path.startsWith('/')) throw new Error('Invalid memory path: use a relative path')
			const safePath = path.endsWith('/') ? path.slice(0, -1) : path
			validateMemoryPath(safePath, { allowRoot: true })
			const prefix = safePath ? `${safePath}/` : ''
			const files: MemoryFileMetadata[] = []
			const prefixes = new Set<string>()
			let cursor: string | undefined

			do {
				const params = new URLSearchParams({ per_page: '1000' })
				if (prefix) params.set('prefix', prefix)
				if (!recursive) params.set('delimiter', '/')
				if (cursor) params.set('cursor', cursor)

				const res = await listObjects(params)
				if (res.status === 404) return []
				if (!res.ok) {
					throw new Error(`R2 list "${prefix}" failed (${res.status}): ${await res.text()}`)
				}
				const json = (await res.json()) as ListObjectsResponse
				if (!json.success) {
					throw new Error(
						`R2 list "${prefix}" failed: ${json.errors?.map((error) => error.message).join(', ') || 'unknown API error'}`
					)
				}

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
				for (const delimitedPrefix of json.result_info?.delimited ?? []) {
					prefixes.add(delimitedPrefix)
				}
				if (files.length + prefixes.size > MAX_LIST_RESULTS || json.result_info?.is_truncated) {
					throw new Error(`R2 listing exceeds ${MAX_LIST_RESULTS} results; choose a narrower path`)
				}

				cursor = json.result_info?.is_truncated ? json.result_info.cursor : undefined
			} while (cursor)

			for (const delimitedPrefix of prefixes) {
				files.push({ path: delimitedPrefix, size: 0, updated_at: new Date().toISOString() })
			}

			return files
		},

		async delete(path: string): Promise<void> {
			const safePath = validateMemoryPath(path)
			const res = await fetch(`${bucketBase}/objects/${encodeKey(safePath)}`, {
				method: 'DELETE',
				headers: authHeaders(),
			})
			if (!res.ok && res.status !== 404) {
				throw new Error(`R2 delete "${safePath}" failed (${res.status}): ${await res.text()}`)
			}
		},
	}
}
