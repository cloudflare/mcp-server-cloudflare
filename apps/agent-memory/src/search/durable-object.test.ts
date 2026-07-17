import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

import { EMBEDDING_DIMENSIONS } from './embeddings'

import type { Env } from '../agent-memory.context'

const testEnv = env as unknown as Env

function vector(first: number, second = 0): number[] {
	const result = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
	result[0] = first
	result[1] = second
	return result
}

function uniqueStub(name: string) {
	const id = testEnv.MEMORY_INDEX.idFromName(`${name}-${crypto.randomUUID()}`)
	return testEnv.MEMORY_INDEX.get(id)
}

describe('MemoryIndex Durable Object', () => {
	it('keeps account index metadata and exact search consistent across updates', async () => {
		const stub = uniqueStub('updates')
		await stub.update({
			path: 'memory/note.md',
			vector: vector(1),
			tags: ['architecture'],
			links: ['memory/other'],
		})
		await stub.update({
			path: 'memory/note.md',
			vector: vector(0, 1),
			tags: ['updated'],
			links: [],
		})

		expect(
			await stub.search({ vector: vector(0, 1), scope: 'memory', limit: 1, timeWeight: false })
		).toEqual([{ id: 'memory/note.md', score: 1 }])
		expect(await stub.tags()).toEqual({ tags: [{ tag: 'updated', count: 1 }] })
		expect(await stub.backlinks('memory/other')).toEqual({ backlinks: [] })
		expect(await stub.stats()).toEqual({ indexed_files: 1, index_size: 1 })
	})

	it('applies scope and tag filters before limiting', async () => {
		const stub = uniqueStub('filters')
		await stub.update({ path: 'memory/a.md', vector: vector(1), tags: ['memory'] })
		await stub.update({
			path: 'conversations/exchanges/a.txt',
			vector: vector(0.99, 0.01),
			tags: ['conversation'],
		})

		expect(
			await stub.search({ vector: vector(1), scope: 'conversations', limit: 1, timeWeight: false })
		).toEqual([{ id: 'conversations/exchanges/a.txt', score: expect.closeTo(0.9999, 3) }])
		expect(
			await stub.search({
				vector: vector(1),
				scope: 'all',
				tags: ['memory'],
				limit: 1,
				timeWeight: false,
			})
		).toEqual([{ id: 'memory/a.md', score: 1 }])
	})

	it('serializes reflection runs per account with an expiring token lock', async () => {
		const stub = uniqueStub('locks')
		const firstToken = crypto.randomUUID()
		const secondToken = crypto.randomUUID()

		expect(await stub.acquireReflectionLock(firstToken, 60_000)).toEqual({ acquired: true })
		expect(await stub.acquireReflectionLock(secondToken, 60_000)).toEqual({ acquired: false })
		await stub.releaseReflectionLock(secondToken)
		expect(await stub.acquireReflectionLock(secondToken, 60_000)).toEqual({ acquired: false })
		await stub.releaseReflectionLock(firstToken)
		expect(await stub.acquireReflectionLock(secondToken, 60_000)).toEqual({ acquired: true })
	})

	it('deletes vectors and their tag/link metadata atomically', async () => {
		const stub = uniqueStub('delete')
		await stub.update({
			path: 'memory/delete.md',
			vector: vector(1),
			tags: ['temporary'],
			links: ['target'],
		})

		await stub.delete('memory/delete.md')

		expect(await stub.search({ vector: vector(1), limit: 5 })).toEqual([])
		expect(await stub.tags()).toEqual({ tags: [] })
		expect(await stub.backlinks('target')).toEqual({ backlinks: [] })
	})
})
