import { RestAiRunner } from '../ai/runner'
import { generateEmbedding } from './embeddings'

import type { Env } from '../agent-memory.context'
import type { CloudflareCredentials } from '../ai/runner'
import type { MemoryIndexRpc, SearchScope } from './durable-object'

/**
 * Account-scoped client over the `MemoryIndex` Durable Object.
 *
 * The R2 bucket is account-scoped, so there is one matching index DO per
 * account (`idFromName(accountId)`). Embeddings are generated before the RPC
 * with that account's token; credentials never cross into durable storage.
 */
export class MemoryIndexClient {
	private readonly stub: MemoryIndexRpc

	constructor(
		env: Env,
		accountId: string,
		private readonly creds: CloudflareCredentials
	) {
		const ns = env.MEMORY_INDEX
		this.stub = ns.get(ns.idFromName(accountId)) as unknown as MemoryIndexRpc
	}

	async update(args: {
		path: string
		content: string
		tags?: string[]
		links?: string[]
		updatedAt?: number
	}) {
		const { vector } = await generateEmbedding(new RestAiRunner(this.creds), args.content)
		return this.stub.update({
			path: args.path,
			vector,
			tags: args.tags,
			links: args.links,
			updatedAt: args.updatedAt,
		})
	}

	async search(args: {
		query: string
		limit?: number
		timeWeight?: boolean
		tags?: string[]
		scope?: SearchScope
	}) {
		if (args.query.length < 1 || args.query.length > 8_000) {
			throw new Error('Search query must be 1-8000 characters')
		}
		const limit = args.limit ?? 5
		if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
			throw new Error('Search limit must be an integer between 1 and 50')
		}
		const { vector } = await generateEmbedding(new RestAiRunner(this.creds), args.query)
		return this.stub.search({
			vector,
			limit,
			timeWeight: args.timeWeight,
			tags: args.tags,
			scope: args.scope,
		})
	}

	delete(path: string) {
		return this.stub.delete(path)
	}

	stats() {
		return this.stub.stats()
	}

	tags() {
		return this.stub.tags()
	}

	filesWithTags(tags: string[]) {
		return this.stub.filesWithTags(tags)
	}

	backlinks(target: string) {
		return this.stub.backlinks(target)
	}

	acquireReflectionLock(token: string, ttlMs: number) {
		return this.stub.acquireReflectionLock(token, ttlMs)
	}

	releaseReflectionLock(token: string) {
		return this.stub.releaseReflectionLock(token)
	}
}
