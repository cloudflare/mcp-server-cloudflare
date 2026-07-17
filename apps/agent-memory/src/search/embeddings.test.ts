import { describe, expect, it } from 'vitest'

import { createMockAI, mockEmbedding } from '../test/mock-ai'
import { EMBEDDING_DIMENSIONS, generateEmbedding, generateEmbeddings } from './embeddings'

describe('generateEmbedding', () => {
	it('should return vector with correct dimensions', async () => {
		const ai = createMockAI()
		const result = await generateEmbedding(ai, 'test input')

		expect(result.vector).toHaveLength(EMBEDDING_DIMENSIONS)
		expect(result.dimensions).toBe(EMBEDDING_DIMENSIONS)
	})

	it('should return normalized vectors (unit length)', async () => {
		const ai = createMockAI()
		const result = await generateEmbedding(ai, 'test input')

		// Calculate magnitude - should be ~1 for normalized vector
		const magnitude = Math.sqrt(result.vector.reduce((sum, val) => sum + val * val, 0))
		expect(magnitude).toBeCloseTo(1, 5)
	})

	it('should return deterministic embeddings for same input', async () => {
		const ai = createMockAI()
		const result1 = await generateEmbedding(ai, 'same text')
		const result2 = await generateEmbedding(ai, 'same text')

		expect(result1.vector).toEqual(result2.vector)
	})

	it('should return different embeddings for different inputs', async () => {
		const ai = createMockAI()
		const result1 = await generateEmbedding(ai, 'first text')
		const result2 = await generateEmbedding(ai, 'second text')

		expect(result1.vector).not.toEqual(result2.vector)
	})

	it('should handle empty text', async () => {
		const ai = createMockAI()
		const result = await generateEmbedding(ai, '')

		expect(result.vector).toHaveLength(EMBEDDING_DIMENSIONS)
		expect(result.dimensions).toBe(EMBEDDING_DIMENSIONS)
		// Empty string should still produce valid vector values
		expect(result.vector.every((v) => typeof v === 'number' && !Number.isNaN(v))).toBe(true)
	})

	it('should handle whitespace-only text', async () => {
		const ai = createMockAI()
		const result = await generateEmbedding(ai, '   \n\t  ')

		expect(result.vector).toHaveLength(EMBEDDING_DIMENSIONS)
		expect(result.vector.every((v) => typeof v === 'number' && !Number.isNaN(v))).toBe(true)
	})

	it('should truncate very long text to 32000 characters', async () => {
		let capturedText = ''
		const mockAI = {
			run: async (_model: string, inputs: { text: string }) => {
				capturedText = inputs.text
				return { data: [{ embedding: mockEmbedding(inputs.text) }] }
			},
		}

		const longText = 'a'.repeat(50000)
		await generateEmbedding(mockAI, longText)

		expect(capturedText.length).toBe(32000)
	})

	it('should not truncate text under 32000 characters', async () => {
		let capturedText = ''
		const mockAI = {
			run: async (_model: string, inputs: { text: string }) => {
				capturedText = inputs.text
				return { data: [{ embedding: mockEmbedding(inputs.text) }] }
			},
		}

		const shortText = 'a'.repeat(1000)
		await generateEmbedding(mockAI, shortText)

		expect(capturedText.length).toBe(1000)
	})

	it('should reject malformed embedding vectors', async () => {
		await expect(
			generateEmbedding({ run: async () => ({ data: [[1, 2, 3]] }) }, 'bad dimensions')
		).rejects.toThrow(/dimension mismatch/)
		await expect(
			generateEmbedding(
				{ run: async () => ({ data: [new Array(EMBEDDING_DIMENSIONS).fill(Number.NaN)] }) },
				'bad values'
			)
		).rejects.toThrow(/non-finite/)
	})

	it('should handle text exactly at truncation limit', async () => {
		let capturedText = ''
		const mockAI = {
			run: async (_model: string, inputs: { text: string }) => {
				capturedText = inputs.text
				return { data: [{ embedding: mockEmbedding(inputs.text) }] }
			},
		}

		const exactText = 'a'.repeat(32000)
		await generateEmbedding(mockAI, exactText)

		expect(capturedText.length).toBe(32000)
	})
})

describe('generateEmbeddings', () => {
	it('should generate embeddings for multiple texts', async () => {
		const ai = createMockAI()
		const texts = ['first', 'second', 'third']
		const results = await generateEmbeddings(ai, texts)

		expect(results).toHaveLength(3)
		for (const result of results) {
			expect(result.vector).toHaveLength(EMBEDDING_DIMENSIONS)
			expect(result.dimensions).toBe(EMBEDDING_DIMENSIONS)
		}
	})

	it('should handle empty array', async () => {
		const ai = createMockAI()
		const results = await generateEmbeddings(ai, [])

		expect(results).toHaveLength(0)
	})

	it('should handle single item array', async () => {
		const ai = createMockAI()
		const results = await generateEmbeddings(ai, ['only one'])

		expect(results).toHaveLength(1)
		expect(results[0].vector).toHaveLength(EMBEDDING_DIMENSIONS)
	})

	it('should process batches of 10', async () => {
		let callCount = 0
		const mockAI = {
			run: async (_model: string, inputs: { text: string }) => {
				callCount++
				return { data: [{ embedding: mockEmbedding(inputs.text) }] }
			},
		}

		// 25 texts should result in 25 individual calls (batched internally as Promise.all)
		const texts = Array.from({ length: 25 }, (_, i) => `text ${i}`)
		await generateEmbeddings(mockAI, texts)

		expect(callCount).toBe(25)
	})

	it('should maintain order of results', async () => {
		const ai = createMockAI()
		const texts = ['alpha', 'beta', 'gamma']
		const results = await generateEmbeddings(ai, texts)

		// Each result should match the single embedding for that text
		for (let i = 0; i < texts.length; i++) {
			const singleResult = await generateEmbedding(ai, texts[i])
			expect(results[i].vector).toEqual(singleResult.vector)
		}
	})

	it('should handle large batch correctly', async () => {
		const ai = createMockAI()
		const texts = Array.from({ length: 50 }, (_, i) => `item ${i}`)
		const results = await generateEmbeddings(ai, texts)

		expect(results).toHaveLength(50)
		results.forEach((result, i) => {
			expect(result.vector).toHaveLength(EMBEDDING_DIMENSIONS)
			// Verify each embedding is unique
			if (i > 0) {
				expect(result.vector).not.toEqual(results[i - 1].vector)
			}
		})
	})

	it('should apply truncation to each text in batch', async () => {
		const capturedTexts: string[] = []
		const mockAI = {
			run: async (_model: string, inputs: { text: string }) => {
				capturedTexts.push(inputs.text)
				return { data: [{ embedding: mockEmbedding(inputs.text) }] }
			},
		}

		const texts = ['a'.repeat(50000), 'b'.repeat(50000), 'short']
		await generateEmbeddings(mockAI, texts)

		expect(capturedTexts[0].length).toBe(32000)
		expect(capturedTexts[1].length).toBe(32000)
		expect(capturedTexts[2].length).toBe(5)
	})
})

describe('EMBEDDING_DIMENSIONS', () => {
	it('should be 1024', () => {
		expect(EMBEDDING_DIMENSIONS).toBe(1024)
	})
})
