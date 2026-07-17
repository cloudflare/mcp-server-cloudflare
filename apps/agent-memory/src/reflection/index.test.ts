import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runReflection } from '.'

import type { MemoryIndexClient } from '../search/client'
import type { R2Storage } from '../storage/r2'
import type { UserContext } from '../user-context'
import type { AgenticReflectionResult } from './agentic'

const runAgenticReflection = vi.hoisted(() => vi.fn())
vi.mock('./agentic', () => ({ runAgenticReflection }))

function createStorage(): R2Storage & { files: Map<string, string> } {
	const files = new Map<string, string>()
	return {
		files,
		async read(path) {
			const content = files.get(path)
			return content === undefined
				? null
				: { path, content, size: content.length, updated_at: '2026-07-17T00:00:00.000Z' }
		},
		async write(path, content) {
			files.set(path, content)
			return {}
		},
		async list(path = '') {
			const prefix = path ? `${path.replace(/\/$/, '')}/` : ''
			return [...files.entries()]
				.filter(([filePath]) => filePath.startsWith(prefix))
				.map(([filePath, content]) => ({
					path: filePath,
					size: content.length,
					updated_at: '2026-07-17T00:00:00.000Z',
				}))
		},
		async delete(path) {
			files.delete(path)
		},
	}
}

function result(overrides: Partial<AgenticReflectionResult> = {}): AgenticReflectionResult {
	return {
		success: true,
		summary: 'Found one improvement',
		proposedEdits: [],
		autoAppliedFixes: [],
		quickScanIterations: 1,
		deepAnalysisIterations: 1,
		flaggedIssues: [],
		...overrides,
	}
}

function context(storage: R2Storage): UserContext {
	return {
		accountId: 'account-id',
		creds: { accountId: 'account-id', apiToken: 'token' },
		storage,
		ai: { run: vi.fn() },
		index: {
			acquireReflectionLock: vi.fn().mockResolvedValue({ acquired: true }),
			releaseReflectionLock: vi.fn().mockResolvedValue(undefined),
		} as unknown as MemoryIndexClient,
		env: {} as UserContext['env'],
	}
}

describe('runReflection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-17T12:00:00Z'))
	})

	afterEach(() => vi.useRealTimers())

	it('stages substantive edits without applying or archiving them', async () => {
		const storage = createStorage()
		storage.files.set('memory/note.md', 'original')
		runAgenticReflection.mockResolvedValue(
			result({
				proposedEdits: [
					{
						path: 'memory/note.md',
						action: 'replace',
						content: 'replacement',
						reason: 'Keep it current',
					},
				],
			})
		)

		const reflection = await runReflection(context(storage))

		expect(reflection.success).toBe(true)
		expect(reflection.proposed).toBe(1)
		expect(storage.files.get('memory/note.md')).toBe('original')
		expect(storage.files.has('memory/reflections/pending/2026-07-17.md')).toBe(true)
		expect(storage.files.has('memory/reflections/pending/2026-07-17.json')).toBe(true)
		expect(storage.files.has('memory/reflections/archive/2026-07-17.md')).toBe(false)
	})

	it('skips another paid reflection while one is awaiting review', async () => {
		const storage = createStorage()
		storage.files.set('memory/reflections/pending/2026-07-16.md', '# pending')

		const reflection = await runReflection(context(storage))

		expect(reflection.skipped).toBe(true)
		expect(reflection.summary).toMatch(/pending reflection/i)
		expect(runAgenticReflection).not.toHaveBeenCalled()
	})

	it('archives partial proposals from a failed run without making them applicable', async () => {
		const storage = createStorage()
		storage.files.set('memory/note.md', 'original')
		runAgenticReflection.mockResolvedValue(
			result({
				success: false,
				error: 'Deep analysis exceeded its limit',
				proposedEdits: [
					{
						path: 'memory/note.md',
						action: 'replace',
						content: 'partial proposal',
						reason: 'Incomplete run',
					},
				],
			})
		)

		const reflection = await runReflection(context(storage))

		expect(reflection.success).toBe(false)
		expect(reflection.proposed).toBe(0)
		expect(storage.files.get('memory/note.md')).toBe('original')
		expect(storage.files.has('memory/reflections/pending/2026-07-17.md')).toBe(false)
		expect(storage.files.has('memory/reflections/archive/2026-07-17.md')).toBe(true)
	})

	it('archives an audit-only record when there are only quick fixes', async () => {
		const storage = createStorage()
		runAgenticReflection.mockResolvedValue(
			result({
				autoAppliedFixes: [
					{ path: 'memory/note.md', fixType: 'newline', reason: 'Add final newline' },
				],
			})
		)

		const reflection = await runReflection(context(storage))

		expect(reflection.autoApplied).toBe(1)
		expect(reflection.proposed).toBe(0)
		expect(storage.files.has('memory/reflections/pending/2026-07-17.md')).toBe(false)
		expect(storage.files.has('memory/reflections/archive/2026-07-17.md')).toBe(true)
	})
})
