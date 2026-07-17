import type { AiRunner } from '../ai/runner'

const EMBEDDING_MODEL = '@cf/baai/bge-m3'
const EMBEDDING_DIMENSIONS = 1024

export interface EmbeddingResult {
	vector: number[]
	dimensions: number
}

export async function generateEmbedding(ai: AiRunner, text: string): Promise<EmbeddingResult> {
	// Truncate text if too long (model limit is typically 8192 tokens)
	const truncatedText = text.slice(0, 32000)

	const response = (await ai.run(EMBEDDING_MODEL, {
		text: truncatedText,
	})) as Record<string, unknown>

	// Workers AI bge-m3 returns { data: [[...numbers...]], shape: [1, 1024] }
	let vector: number[]

	if (response.data && Array.isArray(response.data) && response.data.length > 0) {
		const firstItem = response.data[0]
		if (Array.isArray(firstItem) && typeof firstItem[0] === 'number') {
			// Format: { data: [[number, number, ...]] } - nested array
			vector = firstItem as number[]
		} else if (typeof firstItem === 'object' && firstItem !== null && 'embedding' in firstItem) {
			// Format: { data: [{ embedding: number[] }] }
			vector = (firstItem as { embedding: number[] }).embedding
		} else if (typeof firstItem === 'number') {
			// Format: { data: [number, number, ...] } - flat array
			vector = response.data as number[]
		} else {
			throw new Error(`Unexpected data array format: ${JSON.stringify(response).slice(0, 500)}`)
		}
	} else if (response.data && typeof response.data === 'object' && 'length' in response.data) {
		// Format: { shape: [...], data: Float32Array }
		vector = Array.from(response.data as ArrayLike<number>)
	} else {
		throw new Error(
			`Unexpected embedding response format: ${JSON.stringify(response).slice(0, 500)}`
		)
	}

	if (!vector || vector.length === 0) {
		throw new Error('Empty embedding vector received')
	}
	if (vector.length !== EMBEDDING_DIMENSIONS) {
		throw new Error(
			`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`
		)
	}
	let norm = 0
	for (const value of vector) {
		if (!Number.isFinite(value)) throw new Error('Embedding contains non-finite values')
		norm += value * value
	}
	if (norm === 0) throw new Error('Embedding has zero norm')

	return {
		vector,
		dimensions: vector.length,
	}
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
	ai: AiRunner,
	texts: string[]
): Promise<EmbeddingResult[]> {
	// Process in batches to avoid rate limits
	const batchSize = 10
	const results: EmbeddingResult[] = []

	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize)
		const embeddings = await Promise.all(batch.map((text) => generateEmbedding(ai, text)))
		results.push(...embeddings)
	}

	return results
}

export { EMBEDDING_DIMENSIONS }
