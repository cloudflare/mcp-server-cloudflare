import mime from 'mime'
import mock from 'mock-fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { get_file_name_from_path, get_mime_type, list_files_in_directory } from './fileUtils'

vi.mock('mime', () => {
	return {
		default: {
			getType: vi.fn(),
		},
	}
})

afterEach(async () => {
	mock.restore()
	vi.restoreAllMocks()
})

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
}),
	describe('list_files_in_directory', () => {
		it('lists the files in a directory', async () => {
			mock({
				testDir: {
					cats: 'aurora, luna',
					dogs: 'penny',
				},
			})
			const listFiles = await list_files_in_directory('testDir')
			expect(listFiles).toEqual(['file:///testDir/cats', 'file:///testDir/dogs'])
		}),
			it('throws an error if path is not a directory', async () => {
				mock({
					testDir: {
						cats: 'aurora, luna',
						dogs: 'penny',
					},
				})
				await expect(async () => await list_files_in_directory('testDir/cats')).rejects.toThrow(
					'Failed to read directory'
				)
			}),
			it('treats empty strings as cwd', async () => {
				mock({
					testDir: {
						cats: 'aurora, luna',
						dogs: 'penny',
					},
				})

				const listFiles = await list_files_in_directory('')
				expect(listFiles).toEqual(['file:///../../../../../../testDir'])
			})
	}),
	describe('get_mime_type', async () => {
		it("provides the natural mime type when not 'inode/directory'", async () => {
			vi.mocked(mime.getType).mockReturnValueOnce('theType')
			const mimeType = await get_mime_type('someFile')
			expect(mimeType).toEqual('theType')
		})
		it("overrides mime type for 'inode/directory'", async () => {
			vi.mocked(mime.getType).mockReturnValueOnce('inode/directory')
			const mimeType = await get_mime_type('someDirectory')
			expect(mimeType).toEqual('text/directory')
		})
	})
