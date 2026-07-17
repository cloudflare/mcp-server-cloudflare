/**
 * Domain types shared across the memory tools.
 *
 * The runtime `Env` binding type lives in `agent-memory.context.ts`. These
 * are the data shapes for memory files, search results, and versions.
 */

export interface MemoryFile {
	path: string
	content: string
	updated_at: string
	size: number
}

export interface MemoryFileMetadata {
	path: string
	size: number
	updated_at: string
	// R2 object etag (md5 hex for simple puts, without quotes). Lets a
	// client skip downloading a file whose stored content already matches
	// what it has locally. Omitted for synthetic directory entries
	// (delimited prefixes).
	etag?: string
}

export interface SearchResult {
	path: string
	snippet: string
	score: number
}

export interface MemoryApi {
	read(path: string): Promise<string | null>
	list(path?: string): Promise<MemoryFileMetadata[]>
}
