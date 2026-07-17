import { describe, expect, it } from 'vitest'

import { parseWikilinks } from './wikilinks'

describe('parseWikilinks', () => {
	it('returns empty array for empty content', () => {
		expect(parseWikilinks('')).toEqual([])
	})

	it('returns empty array when there are no wikilinks', () => {
		expect(parseWikilinks('A plain note with [an external link](https://x.com).')).toEqual([])
	})

	it('extracts a plain wikilink', () => {
		expect(parseWikilinks('See [[foo]] for context.')).toEqual(['foo'])
	})

	it('extracts multiple wikilinks in order of first appearance', () => {
		const content = 'See [[alpha]], then [[beta]], then [[gamma]].'
		expect(parseWikilinks(content)).toEqual(['alpha', 'beta', 'gamma'])
	})

	it('strips alias display text: [[foo|display]] -> foo', () => {
		expect(parseWikilinks('Check [[foo|the foo note]].')).toEqual(['foo'])
	})

	it('strips heading anchors: [[foo#heading]] -> foo', () => {
		expect(parseWikilinks('Also [[foo#Conclusion]].')).toEqual(['foo'])
	})

	it('strips block references: [[foo#^block-id]] -> foo', () => {
		expect(parseWikilinks('Cite [[foo#^abc123]].')).toEqual(['foo'])
	})

	it('strips heading + alias: [[foo#heading|display]] -> foo', () => {
		expect(parseWikilinks('Link: [[foo#Intro|intro section]].')).toEqual(['foo'])
	})

	it('treats embeds identically: ![[foo]] -> foo', () => {
		expect(parseWikilinks('Embed: ![[foo]]')).toEqual(['foo'])
	})

	it('handles targets that contain slashes (paths)', () => {
		expect(parseWikilinks('See [[memory/projects/foo]].')).toEqual(['memory/projects/foo'])
	})

	it('preserves case for path-like targets', () => {
		expect(parseWikilinks('See [[Foo]] and [[foo]].')).toEqual(['Foo', 'foo'])
	})

	it('deduplicates repeat links, keeping first occurrence', () => {
		expect(parseWikilinks('[[foo]] again [[foo]] once more [[foo]].')).toEqual(['foo'])
	})

	it('deduplicates across alias variations', () => {
		expect(
			parseWikilinks('[[foo|display one]] then [[foo|display two]] then [[foo#heading]].')
		).toEqual(['foo'])
	})

	it('ignores malformed wikilinks missing closing brackets', () => {
		expect(parseWikilinks('A [[broken link and [[good]] link.')).toEqual(['good'])
	})

	it('does not capture empty wikilinks', () => {
		expect(parseWikilinks('Empty: [[]] and real [[foo]].')).toEqual(['foo'])
	})

	it('does not span newlines inside a single link', () => {
		const content = 'First [[foo\nbar]] then [[baz]].'
		expect(parseWikilinks(content)).toEqual(['baz'])
	})

	it('captures wikilinks in the middle of dense markdown', () => {
		const content = [
			'# Heading',
			'',
			'Some prose with [[alpha]] and **bold** and [[beta|the beta file]].',
			'',
			'- list item with [[gamma]]',
			'- another with ![[delta]]',
			'',
			'```',
			'code block with [[epsilon]]',
			'```',
		].join('\n')
		// Intentionally includes epsilon from the code block — see parser
		// comment about why we don't currently skip fenced code.
		expect(parseWikilinks(content)).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon'])
	})

	it('handles 100 links without blowing up', () => {
		const paths = Array.from({ length: 100 }, (_, i) => `note-${i}`)
		const content = paths.map((p) => `[[${p}]]`).join(' ')
		expect(parseWikilinks(content)).toEqual(paths)
	})
})
