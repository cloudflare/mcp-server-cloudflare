const DEFAULT_MAX_LENGTH = 50000 // ~50KB default max response size

export interface TruncateOptions {
	maxLength?: number
	suffix?: string
}

export interface TruncateResult {
	content: string
	truncated: boolean
	original_size: number
}

/**
 * Truncate content to a maximum length with an optional suffix.
 *
 * Returns the string directly for convenience at call sites that don't
 * care about truncation status. Use `truncateWithMeta` if you need to
 * surface "this was cut" to the caller.
 */
export function truncate(content: string, options: TruncateOptions = {}): string {
	return truncateWithMeta(content, options).content
}

/**
 * Truncate and report whether truncation happened. Tools that return file
 * contents to clients should use this so the client knows if it got the
 * full file or a partial view.
 */
export function truncateWithMeta(content: string, options: TruncateOptions = {}): TruncateResult {
	const { maxLength = DEFAULT_MAX_LENGTH, suffix = '\n\n[Content truncated...]' } = options

	if (content.length <= maxLength) {
		return { content, truncated: false, original_size: content.length }
	}

	// Prefer newlines near the end as cut points so we don't split a line
	// mid-sentence. 80% of the budget is a pragmatic threshold — closer to
	// the limit and we'd refuse good cut points; further away and we'd
	// waste too much budget searching for prettier breaks.
	const truncateAt = maxLength - suffix.length
	const lastNewline = content.lastIndexOf('\n', truncateAt)
	const cutPoint = lastNewline > truncateAt * 0.8 ? lastNewline : truncateAt

	return {
		content: content.slice(0, cutPoint) + suffix,
		truncated: true,
		original_size: content.length,
	}
}

/**
 * Extract a snippet around a match position
 */
export function extractSnippet(
	content: string,
	options: { maxLength?: number; position?: number } = {}
): string {
	const { maxLength = 500, position = 0 } = options

	if (content.length <= maxLength) {
		return content
	}

	// Center the snippet around the position
	const halfLength = Math.floor(maxLength / 2)
	let start = Math.max(0, position - halfLength)
	let end = Math.min(content.length, position + halfLength)

	// Adjust if we're near the edges
	if (start === 0) {
		end = Math.min(content.length, maxLength)
	} else if (end === content.length) {
		start = Math.max(0, content.length - maxLength)
	}

	let snippet = content.slice(start, end)

	// Try to start/end at word boundaries
	if (start > 0) {
		const firstSpace = snippet.indexOf(' ')
		if (firstSpace > 0 && firstSpace < 50) {
			snippet = `...${snippet.slice(firstSpace + 1)}`
		} else {
			snippet = `...${snippet}`
		}
	}

	if (end < content.length) {
		const lastSpace = snippet.lastIndexOf(' ')
		if (lastSpace > snippet.length - 50) {
			snippet = `${snippet.slice(0, lastSpace)}...`
		} else {
			snippet = `${snippet}...`
		}
	}

	return snippet
}
