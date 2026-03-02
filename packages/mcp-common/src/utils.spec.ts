import { describe, expect, it } from 'vitest'

import { nowISO, parseRelativeTime } from './utils'

describe('parseRelativeTime', () => {
	it('parses positive relative time correctly', () => {
		expect(parseRelativeTime('+1h')).toBe(3600)
		expect(parseRelativeTime('+2d')).toBe(172800)
		expect(parseRelativeTime('+3w')).toBe(1814400)
	})

	it('parses negative relative time correctly', () => {
		expect(parseRelativeTime('-1h')).toBe(-3600)
		expect(parseRelativeTime('-2d')).toBe(-172800)
		expect(parseRelativeTime('-3w')).toBe(-1814400)
	})

	it('parses mixed units correctly', () => {
		expect(parseRelativeTime('+1h30m')).toBe(5400)
		expect(parseRelativeTime('-2d6h')).toBe(-194400)
	})

	it('throws an error for invalid formats', () => {
		expect(() => parseRelativeTime('1h')).toThrow()
		expect(() => parseRelativeTime('+')).toThrow()
		expect(() => parseRelativeTime('')).toThrow()
	})
})

describe('nowISO', () => {
	it('returns the current time in ISO format without milliseconds', () => {
		const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
		expect(nowISO()).toMatch(isoRegex)
	})
})
