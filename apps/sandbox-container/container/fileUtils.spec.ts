import { describe, expect, it } from 'vitest'

import { get_file_name_from_path } from './fileUtils'

describe('get_file_name_from_path', () => {
	it('strips files/contents', async () => {
		const path = await get_file_name_from_path('/files/contents/cats')
		expect(path).toBe('/cats')
	}),
		it('works if files/contents is not present', async () => {
			const path = await get_file_name_from_path('/dogs')
			expect(path).toBe('/dogs')
		}),
		it('strips a trailing slash', async () => {
			const path = await get_file_name_from_path('/files/contents/birds/')
			expect(path).toBe('/birds')
		})
})
