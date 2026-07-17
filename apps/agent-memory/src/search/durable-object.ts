import { DurableObject } from 'cloudflare:workers'

import { validateMemoryPath } from '../storage/r2'
import { EMBEDDING_DIMENSIONS } from './embeddings'
import { MemoryVectorIndex } from './vector-index'

export type SearchScope = 'memory' | 'conversations' | 'all'

const MAX_INDEX_ENTRIES = 5_000
const MAX_TAGS_PER_FILE = 100
const MAX_LINKS_PER_FILE = 1_000

/**
 * The `MemoryIndex` DO holds no bindings or credentials. Callers generate
 * embeddings with the selected account's Workers AI before invoking this RPC
 * surface; the DO stores and searches only vectors plus metadata.
 */
type DOEnv = Record<string, never>

export interface MemoryIndexRpc {
	update(args: {
		path: string
		vector: number[]
		tags?: string[]
		links?: string[]
		updatedAt?: number
	}): Promise<{ success: true }>
	search(args: {
		vector: number[]
		limit?: number
		timeWeight?: boolean
		tags?: string[]
		scope?: SearchScope
	}): Promise<Array<{ id: string; score: number }>>
	delete(path: string): Promise<{ success: true }>
	stats(): Promise<{ indexed_files: number; index_size: number }>
	tags(): Promise<{ tags: Array<{ tag: string; count: number }> }>
	filesWithTags(tags: string[]): Promise<{ paths: string[] }>
	backlinks(target: string): Promise<{ backlinks: string[] }>
	acquireReflectionLock(token: string, ttlMs: number): Promise<{ acquired: boolean }>
	releaseReflectionLock(token: string): Promise<void>
}

/**
 * Durable Object for one Cloudflare account's memory search index.
 *
 * One instance exists per account (`idFromName(accountId)`). Embeddings and
 * tag/wikilink metadata persist in SQLite; a bounded in-memory vector index
 * provides deterministic exact cosine search after each cold start.
 */
export class MemoryIndex extends DurableObject<DOEnv> implements MemoryIndexRpc {
	private vectorIndex: MemoryVectorIndex | null = null
	private initialized = false

	private async ensureReady(): Promise<MemoryVectorIndex> {
		if (this.initialized && this.vectorIndex) return this.vectorIndex

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS memories (
				path TEXT PRIMARY KEY,
				embedding BLOB NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`)
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS file_tags (
				path TEXT NOT NULL,
				tag TEXT NOT NULL,
				PRIMARY KEY (path, tag)
			)
		`)
		this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag)')
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS file_links (
				source TEXT NOT NULL,
				target TEXT NOT NULL,
				PRIMARY KEY (source, target)
			)
		`)
		this.ctx.storage.sql.exec(
			'CREATE INDEX IF NOT EXISTS idx_file_links_target ON file_links(target)'
		)
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS operation_locks (
				name TEXT PRIMARY KEY,
				token TEXT NOT NULL,
				locked_until INTEGER NOT NULL
			)
		`)

		const countRow = [
			...this.ctx.storage.sql.exec<{ count: number }>('SELECT COUNT(*) as count FROM memories'),
		][0]
		if ((countRow?.count ?? 0) > MAX_INDEX_ENTRIES) {
			throw new Error(`Memory index exceeds the ${MAX_INDEX_ENTRIES}-entry limit`)
		}

		const vectorIndex = new MemoryVectorIndex(EMBEDDING_DIMENSIONS)
		const invalidPaths: string[] = []
		const cursor = this.ctx.storage.sql.exec('SELECT path, embedding FROM memories')
		for (const row of cursor) {
			try {
				vectorIndex.upsert(row.path as string, decodeVector(row.embedding))
			} catch (error) {
				const path = String(row.path)
				invalidPaths.push(path)
				console.error(`Removing invalid embedding for ${path}:`, error)
			}
		}
		if (invalidPaths.length > 0) {
			this.ctx.storage.transactionSync(() => {
				for (const path of invalidPaths) {
					this.ctx.storage.sql.exec('DELETE FROM memories WHERE path = ?', path)
					this.ctx.storage.sql.exec('DELETE FROM file_tags WHERE path = ?', path)
					this.ctx.storage.sql.exec('DELETE FROM file_links WHERE source = ?', path)
				}
			})
		}

		this.vectorIndex = vectorIndex
		this.initialized = true
		return vectorIndex
	}

	async update(args: {
		path: string
		vector: number[]
		tags?: string[]
		links?: string[]
		updatedAt?: number
	}): Promise<{ success: true }> {
		const path = validateMemoryPath(args.path)
		const updatedAt = args.updatedAt ?? Date.now()
		if (!Number.isFinite(updatedAt) || updatedAt < 0 || updatedAt > Date.now() + 86_400_000) {
			throw new Error('Invalid index update timestamp')
		}
		const tags = normalizeMetadata(args.tags, MAX_TAGS_PER_FILE, 'tags')
		const links = normalizeMetadata(args.links, MAX_LINKS_PER_FILE, 'links', false)
		const vectorIndex = await this.ensureReady()
		if (!vectorIndex.has(path) && vectorIndex.size() >= MAX_INDEX_ENTRIES) {
			throw new Error(`Memory index is limited to ${MAX_INDEX_ENTRIES} entries`)
		}

		// Validate and update memory first; if SQLite fails, restore the prior
		// vector so the two representations remain consistent.
		const previousVector = vectorIndex.getVector(path)
		vectorIndex.upsert(path, args.vector)
		try {
			const embeddingBlob = encodeVector(args.vector)
			this.ctx.storage.transactionSync(() => {
				this.ctx.storage.sql.exec(
					'INSERT OR REPLACE INTO memories (path, embedding, updated_at) VALUES (?, ?, ?)',
					path,
					embeddingBlob,
					Math.floor(updatedAt)
				)

				if (tags !== undefined) {
					this.ctx.storage.sql.exec('DELETE FROM file_tags WHERE path = ?', path)
					for (const tag of tags) {
						this.ctx.storage.sql.exec(
							'INSERT OR IGNORE INTO file_tags (path, tag) VALUES (?, ?)',
							path,
							tag
						)
					}
				}

				if (links !== undefined) {
					this.ctx.storage.sql.exec('DELETE FROM file_links WHERE source = ?', path)
					for (const target of links) {
						this.ctx.storage.sql.exec(
							'INSERT OR IGNORE INTO file_links (source, target) VALUES (?, ?)',
							path,
							target
						)
					}
				}
			})
		} catch (error) {
			if (previousVector) vectorIndex.upsert(path, previousVector)
			else vectorIndex.delete(path)
			throw error
		}

		return { success: true }
	}

	async search(args: {
		vector: number[]
		limit?: number
		timeWeight?: boolean
		tags?: string[]
		scope?: SearchScope
	}): Promise<Array<{ id: string; score: number }>> {
		const vectorIndex = await this.ensureReady()
		const { vector, limit = 5, timeWeight = true, scope = 'all' } = args
		if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
			throw new Error('Search limit must be an integer between 1 and 50')
		}
		if (!['memory', 'conversations', 'all'].includes(scope)) {
			throw new Error('Invalid search scope')
		}
		if (vectorIndex.size() === 0) return []

		const tags = normalizeMetadata(args.tags, 20, 'search tags')
		const tagFilter = tags?.length ? this.resolveTagIntersection(tags) : null
		const isConversation = (id: string) => id.startsWith('conversations/exchanges/')
		const include = (id: string) => {
			if (tagFilter && !tagFilter.has(id)) return false
			if (scope === 'memory' && isConversation(id)) return false
			if (scope === 'conversations' && !isConversation(id)) return false
			return true
		}
		const candidateLimit = timeWeight ? vectorIndex.size() : limit
		const rawResults = vectorIndex.search(vector, candidateLimit, include)
		if (!timeWeight) return rawResults.slice(0, limit)

		const updatedAtByPath = new Map(
			[
				...this.ctx.storage.sql.exec<{ path: string; updated_at: number }>(
					'SELECT path, updated_at FROM memories'
				),
			].map((row) => [row.path, row.updated_at] as const)
		)
		const now = Date.now()
		const halfLifeMs = 30 * 24 * 60 * 60 * 1000
		return rawResults
			.map((result) => {
				const ageMs = Math.max(0, now - (updatedAtByPath.get(result.id) ?? now))
				const timeDecay = 0.5 ** (ageMs / halfLifeMs)
				return { id: result.id, score: result.score * (0.3 + 0.7 * timeDecay) }
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
	}

	async delete(path: string): Promise<{ success: true }> {
		const safePath = validateMemoryPath(path)
		const vectorIndex = await this.ensureReady()
		this.ctx.storage.transactionSync(() => {
			this.ctx.storage.sql.exec('DELETE FROM memories WHERE path = ?', safePath)
			this.ctx.storage.sql.exec('DELETE FROM file_tags WHERE path = ?', safePath)
			this.ctx.storage.sql.exec('DELETE FROM file_links WHERE source = ?', safePath)
		})
		vectorIndex.delete(safePath)
		return { success: true }
	}

	async stats(): Promise<{ indexed_files: number; index_size: number }> {
		const vectorIndex = await this.ensureReady()
		const row = [
			...this.ctx.storage.sql.exec<{ count: number }>('SELECT COUNT(*) as count FROM memories'),
		][0]
		return { indexed_files: row?.count ?? 0, index_size: vectorIndex.size() }
	}

	async tags(): Promise<{ tags: Array<{ tag: string; count: number }> }> {
		await this.ensureReady()
		const rows = [
			...this.ctx.storage.sql.exec<{ tag: string; count: number }>(
				'SELECT tag, COUNT(*) as count FROM file_tags GROUP BY tag ORDER BY count DESC, tag ASC'
			),
		]
		return { tags: rows }
	}

	async filesWithTags(tags: string[]): Promise<{ paths: string[] }> {
		await this.ensureReady()
		const normalized = normalizeMetadata(tags, 20, 'search tags')
		if (!normalized?.length) return { paths: [] }
		return { paths: [...this.resolveTagIntersection(normalized)].sort() }
	}

	async backlinks(target: string): Promise<{ backlinks: string[] }> {
		await this.ensureReady()
		if (!target || target.length > 1024) throw new Error('Invalid backlink target')
		const rows = [
			...this.ctx.storage.sql.exec<{ source: string }>(
				'SELECT source FROM file_links WHERE target = ? ORDER BY source ASC',
				target
			),
		]
		return { backlinks: rows.map((row) => row.source) }
	}

	async acquireReflectionLock(token: string, ttlMs: number): Promise<{ acquired: boolean }> {
		await this.ensureReady()
		if (
			!/^[0-9a-f-]{36}$/i.test(token) ||
			!Number.isInteger(ttlMs) ||
			ttlMs < 1_000 ||
			ttlMs > 3_600_000
		) {
			throw new Error('Invalid reflection lock request')
		}
		return this.ctx.storage.transactionSync(() => {
			const now = Date.now()
			const current = [
				...this.ctx.storage.sql.exec<{ token: string; locked_until: number }>(
					'SELECT token, locked_until FROM operation_locks WHERE name = ?',
					'reflection'
				),
			][0]
			if (current && current.locked_until > now && current.token !== token) {
				return { acquired: false }
			}
			this.ctx.storage.sql.exec(
				'INSERT OR REPLACE INTO operation_locks (name, token, locked_until) VALUES (?, ?, ?)',
				'reflection',
				token,
				now + ttlMs
			)
			return { acquired: true }
		})
	}

	async releaseReflectionLock(token: string): Promise<void> {
		await this.ensureReady()
		this.ctx.storage.sql.exec(
			'DELETE FROM operation_locks WHERE name = ? AND token = ?',
			'reflection',
			token
		)
	}

	private resolveTagIntersection(tags: string[]): Set<string> {
		const normalized = [...new Set(tags.map((tag) => tag.toLowerCase()))]
		const placeholders = normalized.map(() => '?').join(',')
		const rows = [
			...this.ctx.storage.sql.exec<{ path: string }>(
				`SELECT path FROM file_tags
				 WHERE tag IN (${placeholders})
				 GROUP BY path
				 HAVING COUNT(DISTINCT tag) = ?`,
				...normalized,
				normalized.length
			),
		]
		return new Set(rows.map((row) => row.path))
	}
}

function normalizeMetadata(
	values: string[] | undefined,
	limit: number,
	label: string,
	lowercase = true
): string[] | undefined {
	if (values === undefined) return undefined
	if (!Array.isArray(values) || values.length > limit) {
		throw new Error(`Too many ${label}; maximum is ${limit}`)
	}
	const normalized = values.map((value) => {
		if (typeof value !== 'string' || value.length < 1 || value.length > 1024) {
			throw new Error(`Invalid ${label} value`)
		}
		return lowercase ? value.toLowerCase() : value
	})
	return [...new Set(normalized)]
}

function encodeVector(vector: number[]): Uint8Array {
	if (vector.length !== EMBEDDING_DIMENSIONS) {
		throw new Error(
			`Vector dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`
		)
	}
	return new Uint8Array(Float32Array.from(vector).buffer)
}

function decodeVector(raw: unknown): number[] {
	const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer)
	if (bytes.byteLength === EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT) {
		const copy = bytes.slice()
		return Array.from(new Float32Array(copy.buffer))
	}
	// Compatibility with the JSON-encoded prototype format.
	const decoded = new TextDecoder().decode(bytes)
	if (decoded.trimStart().startsWith('[')) return JSON.parse(decoded) as number[]
	throw new Error('Stored embedding has an invalid byte length')
}
