import { describe, expect, it } from 'vitest'

import { MemoryVectorIndex } from './vector-index'

describe('MemoryVectorIndex', () => {
	it('returns exact cosine matches in descending order', () => {
		const index = new MemoryVectorIndex(2)
		index.upsert('exact', [1, 0])
		index.upsert('near', [0.9, 0.1])
		index.upsert('other', [0, 1])

		expect(index.search([1, 0], 2).map((result) => result.id)).toEqual(['exact', 'near'])
	})

	it('updates and deletes entries without stale graph state', () => {
		const index = new MemoryVectorIndex(2)
		index.upsert('doc', [1, 0])
		index.upsert('doc', [0, 1])

		expect(index.size()).toBe(1)
		expect(index.search([0, 1], 1)[0]).toMatchObject({ id: 'doc', score: 1 })
		expect(index.delete('doc')).toBe(true)
		expect(index.search([0, 1], 1)).toEqual([])
	})

	it('applies filters before limiting results', () => {
		const index = new MemoryVectorIndex(2)
		index.upsert('memory/a.md', [1, 0])
		index.upsert('conversations/exchanges/a.txt', [0.99, 0.01])

		const results = index.search([1, 0], 1, (id) => id.startsWith('conversations/'))

		expect(results.map((result) => result.id)).toEqual(['conversations/exchanges/a.txt'])
	})

	it('rejects invalid limits and vectors', () => {
		const index = new MemoryVectorIndex(2)
		index.upsert('doc', [1, 0])

		expect(() => index.search([1, 0], 0)).toThrow(/positive integer/i)
		expect(() => index.search([1], 1)).toThrow(/dimension mismatch/i)
		expect(() => index.upsert('zero', [0, 0])).toThrow(/non-zero/i)
	})
})
