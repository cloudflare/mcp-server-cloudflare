import { describe, expect, it } from 'vitest'

import { extractSnippet, truncate } from './truncate'

describe('truncate', () => {
	it('should not truncate short content', () => {
		const content = 'Hello, world!'
		const result = truncate(content)
		expect(result).toBe(content)
	})

	it('should truncate long content', () => {
		const content = 'a'.repeat(60000)
		const result = truncate(content)

		expect(result.length).toBeLessThan(60000)
		expect(result).toContain('[Content truncated...]')
	})

	it('should respect custom maxLength', () => {
		const content = 'a'.repeat(200)
		const result = truncate(content, { maxLength: 100 })

		expect(result.length).toBeLessThanOrEqual(100 + 25) // maxLength + suffix
	})

	it('should use custom suffix', () => {
		const content = 'a'.repeat(200)
		const result = truncate(content, { maxLength: 100, suffix: '...' })

		expect(result.endsWith('...')).toBe(true)
	})

	it('should try to truncate at newline', () => {
		const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']
		const content = lines.join('\n').padEnd(200, 'x')
		const result = truncate(content, { maxLength: 50 })

		// Should not cut in the middle of a line if possible
		expect(result).toMatch(/Line \d\n/)
	})

	it('should handle content with only newlines', () => {
		const content = '\n'.repeat(100)
		const result = truncate(content, { maxLength: 50 })

		expect(result.length).toBeLessThanOrEqual(75)
	})

	it('should handle empty content', () => {
		const result = truncate('')
		expect(result).toBe('')
	})

	it('should handle content exactly at maxLength', () => {
		const content = 'a'.repeat(50000)
		const result = truncate(content, { maxLength: 50000 })
		expect(result).toBe(content)
	})
})

describe('extractSnippet', () => {
	it('should return full content if under maxLength', () => {
		const content = 'Short content here'
		const result = extractSnippet(content)
		expect(result).toBe(content)
	})

	it('should extract snippet from beginning', () => {
		const content = 'a'.repeat(1000)
		const result = extractSnippet(content, { maxLength: 100, position: 0 })

		expect(result.length).toBeLessThanOrEqual(110) // Allow for ellipsis
		expect(result.startsWith('a')).toBe(true)
	})

	it('should extract snippet from middle', () => {
		const content = `START${'x'.repeat(500)}MIDDLE${'y'.repeat(500)}END`
		const result = extractSnippet(content, {
			maxLength: 100,
			position: content.indexOf('MIDDLE'),
		})

		expect(result).toContain('MIDDLE')
	})

	it('should extract snippet from end', () => {
		const content = `${'a'.repeat(900)}THE END`
		const result = extractSnippet(content, {
			maxLength: 100,
			position: content.length - 5,
		})

		expect(result).toContain('THE END')
	})

	it('should add ellipsis for middle snippets', () => {
		const content = 'word '.repeat(200)
		const result = extractSnippet(content, { maxLength: 100, position: 500 })

		expect(result.startsWith('...')).toBe(true)
		expect(result.endsWith('...')).toBe(true)
	})

	it('should not add leading ellipsis for start snippets', () => {
		const content = 'word '.repeat(200)
		const result = extractSnippet(content, { maxLength: 100, position: 0 })

		expect(result.startsWith('...')).toBe(false)
	})

	it('should not add trailing ellipsis for end snippets', () => {
		const content = 'word '.repeat(200)
		const result = extractSnippet(content, {
			maxLength: 100,
			position: content.length - 1,
		})

		expect(result.endsWith('...')).toBe(false)
	})

	it('should handle empty content', () => {
		const result = extractSnippet('')
		expect(result).toBe('')
	})

	it('should use default values', () => {
		const content = 'a'.repeat(1000)
		const result = extractSnippet(content)

		expect(result.length).toBeLessThanOrEqual(510) // 500 + ellipsis
	})
})
