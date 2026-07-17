import { describe, expect, it } from 'vitest'

import { createMockStorage } from '../test/mock-storage'
import { archiveReflection } from './staging'

describe('archiveReflection', () => {
	it('preserves multiple audit records created on the same day', async () => {
		const storage = createMockStorage()
		await storage.write('memory/reflections/archive/2026-07-17.md', 'first')
		await storage.write('memory/reflections/pending/2026-07-17.md', 'second')
		await storage.write('memory/reflections/pending/2026-07-17.json', '{"second":true}')

		const path = await archiveReflection(storage, 'memory/reflections/pending/2026-07-17.md')

		expect(path).toBe('memory/reflections/archive/2026-07-17-2.md')
		expect((await storage.read('memory/reflections/archive/2026-07-17.md'))?.content).toBe('first')
		expect((await storage.read('memory/reflections/archive/2026-07-17-2.md'))?.content).toBe(
			'second'
		)
		expect(await storage.read('memory/reflections/archive/2026-07-17-2.json')).not.toBeNull()
	})
})
