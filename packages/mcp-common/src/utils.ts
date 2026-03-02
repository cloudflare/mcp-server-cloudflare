/**
 * Utility functions for common operations
 */

/**
 * Parse a relative time string into seconds
 */
export function parseRelativeTime(input: string): number {
	const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 } as const

	const cleanedInput = input.replace(/\s+/g, '').toLowerCase()
	if (!/^[+-](?:\d+[smhdw]){1,}$/.test(cleanedInput)) {
		throw new Error(`Invalid relative time format: ${input}`)
	}

	const sign = cleanedInput.startsWith('-') ? -1 : 1

	const timeStr = cleanedInput.slice(1) // Remove the sign
	const matches = timeStr.match(/\d+[smhdw]/g)

	if (!matches) {
		throw new Error(`No matches found while parsing relative time: ${timeStr}`)
	}

	const seconds = matches.reduce((total, match) => {
		const value = parseInt(match)
		const unit = match.slice(-1) as keyof typeof units

		return total + value * units[unit]
	}, 0)

	return sign * seconds
}

/**
 * Get the current time as an ISO string without milliseconds
 */
export function nowISO(): string {
	return new Date().toISOString().split('.')[0] + 'Z'
}
