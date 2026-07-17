export interface SearchResult {
	id: string
	score: number
}

/**
 * Small, exact cosine-similarity index.
 *
 * Durable Objects rebuild in-memory state after eviction. An approximate graph
 * is expensive to reconstruct and difficult to update correctly after file
 * rewrites/deletes; an exact scan is deterministic and remains bounded by the
 * Durable Object's entry cap.
 */
export class MemoryVectorIndex {
	private readonly vectors = new Map<string, Float32Array>()

	constructor(private readonly dimensions: number) {}

	upsert(id: string, vector: number[]): void {
		this.validateVector(vector)
		this.vectors.set(id, Float32Array.from(vector))
	}

	delete(id: string): boolean {
		return this.vectors.delete(id)
	}

	getVector(id: string): number[] | undefined {
		const vector = this.vectors.get(id)
		return vector ? Array.from(vector) : undefined
	}

	has(id: string): boolean {
		return this.vectors.has(id)
	}

	size(): number {
		return this.vectors.size
	}

	search(
		query: number[],
		limit: number,
		include: (id: string) => boolean = () => true
	): SearchResult[] {
		this.validateVector(query)
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error('Search limit must be a positive integer')
		}

		const results: SearchResult[] = []
		for (const [id, vector] of this.vectors) {
			if (!include(id)) continue
			results.push({ id, score: this.cosineSimilarity(query, vector) })
		}
		return results.sort((a, b) => b.score - a.score).slice(0, limit)
	}

	private validateVector(vector: ArrayLike<number>): void {
		if (vector.length !== this.dimensions) {
			throw new Error(
				`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`
			)
		}
		let norm = 0
		for (let index = 0; index < vector.length; index++) {
			const value = vector[index]
			if (!Number.isFinite(value)) throw new Error('Vector values must be finite')
			norm += value * value
		}
		if (norm === 0) throw new Error('Vector must have a non-zero norm')
	}

	private cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
		let dot = 0
		let normA = 0
		let normB = 0
		for (let index = 0; index < a.length; index++) {
			dot += a[index] * b[index]
			normA += a[index] * a[index]
			normB += b[index] * b[index]
		}
		const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB))
		return Math.max(-1, Math.min(1, similarity))
	}
}
