import { describe, expect, it } from 'vitest'

import { parseTags } from './tags'

describe('parseTags', () => {
	it('returns an empty array when content is empty', () => {
		expect(parseTags('')).toEqual([])
	})

	it('returns an empty array when there is no frontmatter', () => {
		expect(parseTags('Just a plain note with no frontmatter.')).toEqual([])
	})

	it('returns an empty array when frontmatter has no tags key', () => {
		const content = '---\ntitle: Foo\ndate: 2026-01-01\n---\n\nBody'
		expect(parseTags(content)).toEqual([])
	})

	it('parses inline array syntax: tags: [a, b, c]', () => {
		const content = '---\ntags: [alpha, beta, gamma]\n---\n\nBody'
		expect(parseTags(content)).toEqual(['alpha', 'beta', 'gamma'])
	})

	it('parses block list syntax', () => {
		const content = ['---', 'tags:', '  - alpha', '  - beta', '  - gamma', '---', '', 'Body'].join(
			'\n'
		)
		expect(parseTags(content)).toEqual(['alpha', 'beta', 'gamma'])
	})

	it('parses a single scalar tag', () => {
		const content = '---\ntags: solo\n---\n\nBody'
		expect(parseTags(content)).toEqual(['solo'])
	})

	it('lowercases tags for stable indexing', () => {
		const content = '---\ntags: [FooBar, BAZ]\n---\n\nBody'
		expect(parseTags(content)).toEqual(['foobar', 'baz'])
	})

	it('strips leading # from Obsidian-style tags', () => {
		const content = "---\ntags: ['#alpha', '#beta']\n---\n\nBody"
		expect(parseTags(content)).toEqual(['alpha', 'beta'])
	})

	it('strips surrounding quotes around values', () => {
		const content = `---\ntags: ["quoted", 'single']\n---\n\nBody`
		expect(parseTags(content)).toEqual(['quoted', 'single'])
	})

	it('deduplicates tags, preserving first occurrence order', () => {
		const content = '---\ntags: [alpha, BETA, alpha, Beta, gamma]\n---\n\nBody'
		expect(parseTags(content)).toEqual(['alpha', 'beta', 'gamma'])
	})

	it('ignores frontmatter fields after tags: in a block list', () => {
		const content = [
			'---',
			'title: Foo',
			'tags:',
			'  - alpha',
			'  - beta',
			'date: 2026-01-01',
			'---',
			'',
			'Body',
		].join('\n')
		expect(parseTags(content)).toEqual(['alpha', 'beta'])
	})

	it('handles CRLF line endings', () => {
		const content = '---\r\ntags: [alpha, beta]\r\n---\r\n\r\nBody'
		expect(parseTags(content)).toEqual(['alpha', 'beta'])
	})

	it('returns empty for an empty inline array', () => {
		const content = '---\ntags: []\n---\n\nBody'
		expect(parseTags(content)).toEqual([])
	})

	it('tolerates empty list items by skipping them', () => {
		const content = ['---', 'tags:', '  - alpha', '  - ', '  - beta', '---', '', 'Body'].join('\n')
		expect(parseTags(content)).toEqual(['alpha', 'beta'])
	})

	it('does not treat frontmatter-like content mid-file as frontmatter', () => {
		const content = ['# Heading', '', '---', 'tags: [nope]', '---', '', 'Body'].join('\n')
		expect(parseTags(content)).toEqual([])
	})

	it('handles frontmatter at the very end of the file (no body)', () => {
		const content = '---\ntags: [alpha]\n---'
		expect(parseTags(content)).toEqual(['alpha'])
	})
})
