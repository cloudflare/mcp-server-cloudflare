import { parseTags } from '../tags'
import { extractSnippet } from '../truncate'
import { parseWikilinks } from '../wikilinks'

import type { R2Storage } from '../storage/r2'
import type { MemoryIndexClient } from './client'

export interface IndexWriteResult {
	success: boolean
	version_id?: string
	tags: string[]
	links: string[]
	embedding_error?: string
	overlap_error?: string
	overlaps?: Array<{ path: string; score: number; snippet: string }>
}

export interface IndexWriteOptions {
	/**
	 * Run a similarity search after the embedding update and surface the
	 * top matches as `overlaps`. Adds an extra DO round-trip plus up to 5
	 * R2 reads, so leave off for bulk or low-stakes writes.
	 */
	detectOverlaps?: boolean
	/**
	 * Opt in to writing empty content. Refused by default: an empty-string
	 * write silently destroys whatever was at `path`.
	 */
	allowEmpty?: boolean
}

/**
 * Thrown by `indexWrite` when the caller passes empty content without
 * setting `allowEmpty: true`.
 */
export class EmptyContentError extends Error {
	constructor(path: string) {
		super(
			`Refusing to write empty content to ${path}. Pass allow_empty: true to override (this overwrites the existing file with zero bytes).`
		)
		this.name = 'EmptyContentError'
	}
}

/**
 * Write a file to R2 and update the search index in one go.
 *
 * Persists to the selected account's R2 bucket, parses tags + wikilinks out
 * of the content, pushes the embedding update to the account's index DO, and
 * (optionally) surfaces semantic overlap warnings so callers don't silently
 * create duplicate memory files.
 *
 * Errors in the embedding update don't fail the whole write — the file
 * still lands in R2, and the caller gets `embedding_error` to surface.
 */
export async function indexWrite(
	index: MemoryIndexClient,
	storage: R2Storage,
	path: string,
	content: string,
	options: IndexWriteOptions = {}
): Promise<IndexWriteResult> {
	if (content.length === 0 && !options.allowEmpty) {
		throw new EmptyContentError(path)
	}

	const result = await storage.write(path, content)
	const tags = parseTags(content)
	const links = parseWikilinks(content)

	const response: IndexWriteResult = {
		success: true,
		version_id: result.version_id,
		tags,
		links,
	}

	if (content.length === 0) {
		try {
			await index.delete(path)
		} catch (error) {
			response.embedding_error = error instanceof Error ? error.message : String(error)
		}
		return response
	}

	const wantOverlaps = options.detectOverlaps && path.startsWith('memory/')

	try {
		await index.update({ path, content, tags, links })
	} catch (error) {
		response.embedding_error = error instanceof Error ? error.message : String(error)
		// Never leave an old vector pointing at content that has already been
		// replaced in R2. A missing search hit is safer than a stale one.
		try {
			await index.delete(path)
		} catch (deleteError) {
			console.error(`Failed to remove stale index entry for ${path}:`, deleteError)
		}
		return response
	}

	if (wantOverlaps) {
		try {
			const OVERLAP_THRESHOLD = 0.72
			const candidates = await index.search({
				query: content.slice(0, 8000),
				limit: 5,
				timeWeight: false,
				scope: 'memory',
			})
			const overlaps = await Promise.all(
				candidates
					.filter(
						(candidate) =>
							candidate.id !== path &&
							candidate.id.startsWith('memory/') &&
							candidate.score >= OVERLAP_THRESHOLD
					)
					.map(async (candidate) => {
						const file = await storage.read(candidate.id)
						return {
							path: candidate.id,
							score: Math.round(candidate.score * 1000) / 1000,
							snippet: file ? extractSnippet(file.content, { maxLength: 300 }) : '',
						}
					})
			)
			if (overlaps.length > 0) response.overlaps = overlaps
		} catch (error) {
			response.overlap_error = error instanceof Error ? error.message : String(error)
		}
	}

	return response
}
