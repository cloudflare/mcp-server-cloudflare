/**
 * Mock for Workers AI embedding model
 * Returns deterministic embeddings based on text content for testing
 */

const DIMENSIONS = 1024

/**
 * Generate a deterministic mock embedding from text
 * Uses a simple hash-based approach for reproducibility
 */
export function mockEmbedding(text: string): number[] {
	const embedding = new Array(DIMENSIONS).fill(0)

	// Simple hash function
	let hash = 0
	for (let i = 0; i < text.length; i++) {
		const char = text.charCodeAt(i)
		hash = ((hash << 5) - hash + char) | 0
	}

	// Seed random number generator with hash
	const seed = Math.abs(hash)
	const random = mulberry32(seed)

	// Generate embedding values
	for (let i = 0; i < DIMENSIONS; i++) {
		embedding[i] = random() * 2 - 1 // Values between -1 and 1
	}

	// Normalize to unit vector
	const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
	for (let i = 0; i < DIMENSIONS; i++) {
		embedding[i] /= magnitude
	}

	return embedding
}

/**
 * Mulberry32 PRNG for reproducible random numbers
 */
function mulberry32(initialSeed: number): () => number {
	let seed = initialSeed
	return () => {
		seed += 0x6d2b79f5
		let t = seed
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * Mock AI binding for tests
 */
export function createMockAI() {
	return {
		run: async (_model: string, inputs: { text: string | string[] }) => {
			const texts = Array.isArray(inputs.text) ? inputs.text : [inputs.text]
			const embeddings = texts.map((text) => ({
				embedding: mockEmbedding(text),
			}))

			return { data: embeddings }
		},
	}
}

/**
 * Pre-computed embeddings for common test phrases
 * These maintain semantic relationships for testing search
 */
export const testEmbeddings = {
	// Similar phrases should have similar embeddings
	'machine learning': mockEmbedding('machine learning'),
	'deep learning': mockEmbedding('deep learning'),
	'neural networks': mockEmbedding('neural networks'),

	// Different topic
	cooking: mockEmbedding('cooking recipes and food'),
	'italian food': mockEmbedding('italian pasta and pizza'),

	// Code related
	typescript: mockEmbedding('typescript programming language'),
	javascript: mockEmbedding('javascript programming language'),
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0
	let normA = 0
	let normB = 0

	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
