import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class McpError extends Error {
	code: ContentfulStatusCode
	constructor(message: string, code: ContentfulStatusCode) {
		super(message)
		this.code = code
		this.name = 'MCPError'
	}
}
