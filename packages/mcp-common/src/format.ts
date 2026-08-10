import { writeToString } from '@fast-csv/format'

/**
 * A collection of formatting functions (think of it like Golang's `fmt` package)
 */
export const fmt = {
	/**
	 * Trims all lines of a string.
	 * Useful for formatting tool instructions.
	 */
	trim: (str: string): string =>
		str
			.trim()
			.split('\n')
			.map((line) => line.trim())
			.join('\n'),

	/**
	 * Converts a multi-line string into a single line.
	 * Useful for formatting tool instructions.
	 */
	oneLine: (str: string): string =>
		str
			.trim()
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.join(' '),

	/**
	 * Convert an array of objects to a string of tab-separated values (TSV).
	 * This is better than JSON for returning data to the model because it uses fewer tokens
	 */
	asTSV: (data: any[]): Promise<string> => writeToString(data, { headers: true, delimiter: '\t' }),
} as const
