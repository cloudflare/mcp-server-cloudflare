import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockStorage } from '../test/mock-storage'
import { createExecutionContext, executeReflectionTool } from './tool-executor'

import type { MemoryIndexClient } from '../search/client'

const index = {
	search: vi.fn().mockResolvedValue([]),
	backlinks: vi.fn().mockResolvedValue({ backlinks: [] }),
	update: vi.fn().mockResolvedValue({ success: true }),
	delete: vi.fn().mockResolvedValue({ success: true }),
} as unknown as MemoryIndexClient

function call(name: string, args: Record<string, unknown>) {
	return { id: `call-${name}`, name, arguments: args }
}

describe('reflection tool executor', () => {
	beforeEach(() => vi.clearAllMocks())

	it('cannot read or edit Agent Memory internal state', async () => {
		const storage = createMockStorage()
		storage._files.set('.mcp/config.json', {
			content: '{"webhookHeaders":{"Authorization":"secret"}}',
			updated_at: new Date().toISOString(),
		})
		const context = createExecutionContext(storage, index)

		const read = await executeReflectionTool(
			call('readFile', { path: '.mcp/config.json' }),
			context
		)
		const edit = await executeReflectionTool(
			call('proposeEdit', {
				path: 'memory/reflections/pending/2026-07-17.md',
				action: 'replace',
				content: 'tampered',
				reason: 'test',
			}),
			context
		)

		expect(read.success).toBe(false)
		expect(read.error).toMatch(/only access user-authored files/)
		expect(edit.success).toBe(false)
		expect(edit.error).toMatch(/only access user-authored files/)
	})

	it('applies a low-risk fix and refreshes its search entry', async () => {
		const storage = createMockStorage()
		storage._files.set('memory/note.md', {
			content: 'A tset.',
			updated_at: new Date().toISOString(),
		})
		const context = createExecutionContext(storage, index)

		const result = await executeReflectionTool(
			call('autoApply', {
				path: 'memory/note.md',
				fixType: 'typo',
				oldText: 'tset',
				newText: 'test',
				reason: 'Fix typo',
			}),
			context
		)

		expect(result.success).toBe(true)
		expect((await storage.read('memory/note.md'))?.content).toBe('A test.')
		expect(index.update).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'memory/note.md', content: 'A test.' })
		)
	})

	it('records a source hash so later apply cannot overwrite newer content', async () => {
		const storage = createMockStorage()
		storage._files.set('memory/note.md', {
			content: 'original',
			updated_at: new Date().toISOString(),
		})
		const context = createExecutionContext(storage, index)

		const result = await executeReflectionTool(
			call('proposeEdit', {
				path: 'memory/note.md',
				action: 'replace',
				content: 'replacement',
				reason: 'Update note',
			}),
			context
		)

		expect(result.success).toBe(true)
		expect(context.proposedEdits[0].expectedContentHash).toMatch(/^[0-9a-f]{64}$/)
	})

	it('rejects malformed model tool arguments instead of staging them', async () => {
		const storage = createMockStorage()
		storage._files.set('memory/note.md', {
			content: 'note',
			updated_at: new Date().toISOString(),
		})
		const context = createExecutionContext(storage, index)

		const invalidAction = await executeReflectionTool(
			call('proposeEdit', {
				path: 'memory/note.md',
				action: 'execute',
				reason: 'invalid',
			}),
			context
		)
		const invalidFinish = await executeReflectionTool(
			call('finishReflection', {
				summary: 'done',
				proposedChanges: -1,
				autoApplied: 0,
			}),
			context
		)

		expect(invalidAction.success).toBe(false)
		expect(invalidFinish.success).toBe(false)
		expect(context.proposedEdits).toEqual([])
	})
})
