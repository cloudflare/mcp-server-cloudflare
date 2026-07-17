/**
 * Shared helpers for memory tool handlers.
 *
 * MCP tools return `{ content: [{ type: "text", text }], isError? }`. These
 * helpers keep every handler's success/error shaping consistent.
 */

export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>
	isError?: boolean
}

/**
 * Build a successful tool response. A short human-readable prefix is
 * prepended to the JSON payload so transcripts are readable without parsing.
 */
export function okResult(data: unknown, prefix?: string): ToolResult {
	const json = JSON.stringify(data)
	const text = prefix ? `${prefix}\n\n${json}` : json
	return { content: [{ type: 'text', text }] }
}

/**
 * Build an error tool response. Always sets `isError: true`.
 *
 * `details` is handled polymorphically: `Error` instances contribute their
 * `message`, plain objects are merged into the body as additional fields,
 * and everything else is coerced to a string under `details`.
 */
export function errResult(error: string, details?: unknown): ToolResult {
	const body: Record<string, unknown> = { error }
	if (details instanceof Error) {
		body.details = details.message
	} else if (typeof details === 'string') {
		body.details = details
	} else if (details && typeof details === 'object') {
		Object.assign(body, details)
	} else if (details !== undefined) {
		body.details = String(details)
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(body) }],
		isError: true,
	}
}

export function isToolResult(value: unknown): value is ToolResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		'content' in value &&
		Array.isArray((value as ToolResult).content)
	)
}
