import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockStorage } from '../test/mock-storage'
import { runAgenticReflection } from './agentic'

import type { MemoryIndexClient } from '../search/client'

const complete = vi.hoisted(() => vi.fn())
vi.mock('../llm/workers-ai', () => ({
	WorkersAIProvider: class {
		complete = complete
	},
	REFLECTION_MODELS: {
		primary: '@cf/test/primary',
		fast: '@cf/test/fast',
		fallback: '@cf/test/fallback',
		legacy: '@cf/test/legacy',
	},
}))

const index = {
	search: vi.fn().mockResolvedValue([]),
	backlinks: vi.fn().mockResolvedValue({ backlinks: [] }),
	update: vi.fn().mockResolvedValue({ success: true }),
	delete: vi.fn().mockResolvedValue({ success: true }),
} as unknown as MemoryIndexClient

describe('runAgenticReflection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('pairs every multi-turn tool result with the provider call ID', async () => {
		complete
			.mockResolvedValueOnce({
				response: '',
				toolCalls: [{ id: 'quick-list', name: 'listFiles', arguments: { path: 'memory' } }],
			})
			.mockResolvedValueOnce({
				response: '',
				toolCalls: [
					{
						id: 'quick-finish',
						name: 'finishQuickScan',
						arguments: { autoApplied: 0, flaggedForDeepAnalysis: 0 },
					},
				],
			})
			.mockResolvedValueOnce({
				response: '',
				toolCalls: [
					{
						id: 'deep-finish',
						name: 'finishReflection',
						arguments: { summary: 'Done', proposedChanges: 0, autoApplied: 0 },
					},
				],
			})

		const result = await runAgenticReflection({
			ai: { run: vi.fn() },
			storage: createMockStorage(),
			index,
		})

		expect(result.success).toBe(true)
		expect(complete.mock.calls[1][0]).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: 'assistant',
					tool_calls: [expect.objectContaining({ id: 'quick-list' })],
				}),
				{ role: 'tool', content: expect.any(String), tool_call_id: 'quick-list' },
			])
		)
	})

	it('reports failure instead of silently succeeding when a phase exhausts its iterations', async () => {
		complete.mockResolvedValue({
			response: '',
			toolCalls: [{ id: 'keep-going', name: 'listFiles', arguments: { path: 'memory' } }],
		})

		const result = await runAgenticReflection({
			ai: { run: vi.fn() },
			storage: createMockStorage(),
			index,
		})

		expect(result.success).toBe(false)
		expect(result.error).toMatch(/Quick scan exceeded 5 iterations/)
		expect(complete).toHaveBeenCalledTimes(5)
	})
})
