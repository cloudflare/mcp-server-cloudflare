import type { ClientErrorStatusCode, ContentfulStatusCode } from 'hono/utils/http-status'

const KNOWN_CLIENT_ERROR_CODES = new Set<number>([
	400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418,
	421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
])

/**
 * Safely maps an HTTP status code to a ContentfulStatusCode.
 * Unknown 4xx codes fall back to 400; 5xx codes map to 502.
 */
export function safeStatusCode(status: number): ContentfulStatusCode {
	if (KNOWN_CLIENT_ERROR_CODES.has(status)) return status as ClientErrorStatusCode
	if (status >= 400 && status < 500) return 400
	if (status >= 500) return 502
	return 500
}

export class McpError extends Error {
	public code: ContentfulStatusCode
	public reportToSentry: boolean
	// error message for internal use
	public internalMessage?: string
	public cause?: Error
	constructor(
		message: string,
		code: ContentfulStatusCode,
		opts: {
			reportToSentry: boolean
			internalMessage?: string
			cause?: Error
		} = { reportToSentry: false }
	) {
		super(message)
		this.code = code
		this.name = 'MCPError'
		this.reportToSentry = opts.reportToSentry
		this.internalMessage = opts.internalMessage
		this.cause = opts.cause
	}
}
