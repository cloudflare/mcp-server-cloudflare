import { describe, expect, it } from 'vitest'

import { stripProtocolFromFilePath } from './utils'

describe('get_file_name_from_path', () => {
	it('strips file:// protocol from path', async () => {
		const path = await stripProtocolFromFilePath('file:///files/contents/cats')
		expect(path).toBe('/files/contents/cats')
	}),
		it('leaves protocol-less paths untouched', async () => {
			const path = await stripProtocolFromFilePath('/files/contents/cats')
			expect(path).toBe('/files/contents/cats')
		})
})
