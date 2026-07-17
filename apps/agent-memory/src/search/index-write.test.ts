import { indexWrite } from './index-write'
import { describe, expect, it, vi } from 'vitest'

import { createMockStorage } from '../test/mock-storage'

import type { MemoryIndexClient } from './client'

function mockIndex(overrides: Partial<Record<keyof MemoryIndexClient, unknown>> = {}) {
	return {
		update: vi.fn().mockResolvedValue({ success: true }),
		delete: vi.fn().mockResolvedValue({ success: true }),
		search: vi.fn().mockResolvedValue([]),
		...overrides,
	} as unknown as MemoryIndexClient
}

describe('indexWrite', () => {
	it('removes the prior vector when deliberately truncating a file', async () => {
		const storage = createMockStorage()
		const index = mockIndex()

		const result = await indexWrite(index, storage, 'memory/empty.md', '', { allowEmpty: true })

		expect(index.delete).toHaveBeenCalledWith('memory/empty.md')
		expect(index.update).not.toHaveBeenCalled()
		expect(result.embedding_error).toBeUndefined()
	})

	it('removes a stale prior vector when the replacement cannot be embedded', async () => {
		const storage = createMockStorage()
		const index = mockIndex({ update: vi.fn().mockRejectedValue(new Error('AI unavailable')) })

		const result = await indexWrite(index, storage, 'memory/note.md', 'new content')

		expect(result.embedding_error).toBe('AI unavailable')
		expect(index.delete).toHaveBeenCalledWith('memory/note.md')
		expect((await storage.read('memory/note.md'))?.content).toBe('new content')
	})

	it('keeps a successful index update when optional overlap detection fails', async () => {
		const storage = createMockStorage()
		const index = mockIndex({ search: vi.fn().mockRejectedValue(new Error('search unavailable')) })

		const result = await indexWrite(index, storage, 'memory/note.md', 'new content', {
			detectOverlaps: true,
		})

		expect(result.overlap_error).toBe('search unavailable')
		expect(index.delete).not.toHaveBeenCalled()
	})
})
