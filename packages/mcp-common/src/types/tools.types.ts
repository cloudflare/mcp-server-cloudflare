import type { ServerContext, ToolAnnotations } from '@modelcontextprotocol/server'
import type { z } from 'zod'
import type { AccountToolResult } from '../account-tool'

/** Declarative definition for a request-scoped account tool. */
export interface AccountToolDefinition<Shape extends z.ZodRawShape> {
	name: string
	config: {
		description: string
		inputSchema: z.ZodObject<Shape>
		annotations?: ToolAnnotations
	}
	handler: (
		params: z.output<z.ZodObject<Shape>>,
		accountId: string,
		ctx: ServerContext
	) => AccountToolResult
}
