import type { Env } from '../agent-memory.context'
import type { CloudflareCredentials } from '../ai/runner'
import type { MemoryIndexRpc } from './durable-object'

/**
 * Per-user client over the `MemoryIndex` Durable Object.
 *
 * There is one DO instance per user (`idFromName(userId)`), so each user's
 * embeddings + tag/link index are fully isolated. Embedding generation
 * happens *inside* the DO but bills the user's account: the client injects
 * the user's Cloudflare credentials into every `update`/`search` call, and
 * the DO uses them to call Workers AI via REST.
 */
export class MemoryIndexClient {
	private readonly stub: MemoryIndexRpc

	constructor(
		env: Env,
		private readonly userId: string,
		private readonly creds: CloudflareCredentials
	) {
		const ns = env.MEMORY_INDEX
		this.stub = ns.get(ns.idFromName(userId)) as unknown as MemoryIndexRpc
	}

	update(args: { path: string; content: string; tags?: string[]; links?: string[] }) {
		return this.stub.update({ ...args, ai: this.creds })
	}

	search(args: { query: string; limit?: number; timeWeight?: boolean; tags?: string[] }) {
		return this.stub.search({ ...args, ai: this.creds })
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
}
