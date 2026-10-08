import { describe, expect, it } from 'vitest'

import { bytesToBase64, stripProtocolFromFilePath, toWorkdirPath } from './utils'

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

describe('toWorkdirPath', () => {
	it.each([
		['/notes.txt', 'notes.txt'],
		['notes.txt', 'notes.txt'],
		['//src/app.py', 'src/app.py'],
		['/', '.'],
		['', '.'],
	])('resolves %j to %j', (input, expected) => {
		expect(toWorkdirPath(input)).toBe(expected)
	})
})

describe('bytesToBase64', () => {
	it('encodes binary bytes', () => {
		expect(bytesToBase64(new Uint8Array([0, 255, 137, 80, 78, 71]))).toBe('AP+JUE5H')
	})
})
