import mime from 'mime'
import mock from 'mock-fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	get_file_name_from_path,
	get_mime_type,
	list_files_in_directory,
	PathTraversalError,
	resolve_in_workdir,
} from './fileUtils'

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
				expect(listFiles).toHaveLength(1)
				expect(listFiles[0]).toMatch(/^file:\/\/\/.*testDir$/)
			}),
			it('rejects a directory path that escapes the working directory', async () => {
				mock({
					testDir: {
						cats: 'aurora, luna',
					},
				})

				await expect(async () => await list_files_in_directory('../../etc')).rejects.toThrow(
					PathTraversalError
				)
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

describe('resolve_in_workdir', () => {
	it('resolves an ordinary relative path inside the working directory', () => {
		expect(resolve_in_workdir('cats')).toBe(`${process.cwd()}/cats`)
	})

	it('resolves a leading-slash path as relative to the working directory, matching prior path.join behavior', () => {
		expect(resolve_in_workdir('/cats/dog.txt')).toBe(`${process.cwd()}/cats/dog.txt`)
	})

	it('rejects a relative path that climbs above the working directory', () => {
		expect(() => resolve_in_workdir('../../etc/passwd')).toThrow(PathTraversalError)
	})

	it('treats an absolute path as relative to the working directory rather than the filesystem root', () => {
		expect(resolve_in_workdir('/etc/passwd')).toBe(`${process.cwd()}/etc/passwd`)
	})

	it('rejects a path that only escapes after internal .. segments are resolved', () => {
		expect(() => resolve_in_workdir('foo/../../bar')).toThrow(PathTraversalError)
	})

	it('rejects the bare parent-directory segment', () => {
		expect(() => resolve_in_workdir('..')).toThrow(PathTraversalError)
	})
})
