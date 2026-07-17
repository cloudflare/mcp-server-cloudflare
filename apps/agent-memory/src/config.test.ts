import { describe, expect, it } from 'vitest'

import { loadConfig, saveConfig } from './config'
import { createMockStorage } from './test/mock-storage'

describe('Agent Memory config', () => {
	it('enables on-demand reflection by default when no config exists', async () => {
		expect(await loadConfig(createMockStorage())).toEqual({ reflectionsEnabled: true })
	})

	it('fails closed when stored config is malformed', async () => {
		const storage = createMockStorage()
		await storage.write('.mcp/config.json', '{not json')

		expect(await loadConfig(storage)).toEqual({ reflectionsEnabled: false })
	})

	it('validates model IDs and webhook protocols before saving', async () => {
		const storage = createMockStorage()

		await expect(saveConfig(storage, { webhookUrl: 'file:///etc/passwd' })).rejects.toThrow(
			/Invalid Agent Memory config/
		)
		await expect(saveConfig(storage, { reflectionModel: '../../bad' })).rejects.toThrow(
			/Invalid Agent Memory config/
		)
	})
})
