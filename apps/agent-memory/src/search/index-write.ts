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
	overlaps?: Array<{ path: string; score: number; snippet: string }>
	/**
	 * `true` when the embedding update was deferred via `ctx.waitUntil` and
	 * has not been awaited. The R2 write has already landed; the search
	 * index will become consistent within ~1–3s.
	 */
	index_deferred?: boolean
}

export interface IndexWriteOptions {
	/**
	 * Run a similarity search after the embedding update and surface the
	 * top matches as `overlaps`. Adds an extra DO round-trip plus up to 5
	 * R2 reads, so leave off for bulk or low-stakes writes.
	 */
	detectOverlaps?: boolean
	/**
	 * Cloudflare ExecutionContext. When provided together with
	 * `waitForIndex: false`, the embedding update runs in `ctx.waitUntil`
	 * and the function returns as soon as the R2 write lands.
	 */
	ctx?: ExecutionContext
	/**
	 * When `false` and `ctx` is provided, defer the embedding update to
	 * `ctx.waitUntil` and return immediately after the R2 write. Default:
	 * `true`. Mutually exclusive with `detectOverlaps: true` — overlap
	 * detection needs the index update to complete first, so it wins.
	 */
	waitForIndex?: boolean
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
 * Persists to the user's R2 bucket, parses tags + wikilinks out of the
 * content, pushes the embedding update to the user's index DO, and
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

	const wantOverlaps = options.detectOverlaps && path.startsWith('memory/')
	const shouldDefer = options.ctx && options.waitForIndex === false && !wantOverlaps

	if (shouldDefer && options.ctx) {
		options.ctx.waitUntil(
			index.update({ path, content, tags, links }).catch((e) => {
				console.error(`Deferred index update failed for ${path}:`, e)
			})
		)
		response.index_deferred = true
		return response
	}

	try {
		await index.update({ path, content, tags, links })

		if (wantOverlaps) {
			const OVERLAP_THRESHOLD = 0.72
			const candidates = await index.search({
				query: content.slice(0, 8000),
				limit: 5,
				timeWeight: false,
			})
			const overlaps = await Promise.all(
				candidates
					.filter(
						(c) => c.id !== path && c.id.startsWith('memory/') && c.score >= OVERLAP_THRESHOLD
					)
					.map(async (c) => {
						const file = await storage.read(c.id)
						return {
							path: c.id,
							score: Math.round(c.score * 1000) / 1000,
							snippet: file ? extractSnippet(file.content, { maxLength: 300 }) : '',
						}
					})
			)
			if (overlaps.length > 0) {
				response.overlaps = overlaps
			}
		}
	} catch (e) {
		response.embedding_error = e instanceof Error ? e.message : String(e)
	}

	return response
}
