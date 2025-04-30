import type { ContentfulStatusCode } from 'hono/utils/http-status'

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
