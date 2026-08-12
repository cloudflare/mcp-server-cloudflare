import { AccountIdParam, CF_ACCOUNT_ID_HEADER } from './account-manager'

import type {
	CallToolResult,
	InputRequiredResult,
	ServerContext,
	ToolCallback,
} from '@modelcontextprotocol/server'
import type { z } from 'zod'
import type { AccountManager } from './account-manager'

export type AccountToolResult =
	| CallToolResult
	| InputRequiredResult
	| Promise<CallToolResult | InputRequiredResult>

/**
 * Handler for an account-scoped tool. The account id has already been resolved from
 * authenticated request state before the handler runs.
 */
export type AccountToolCallback<Shape extends z.ZodRawShape> = (
	args: z.output<z.ZodObject<Shape>>,
	accountId: string,
	ctx: ServerContext
) => AccountToolResult

/**
 * Builds the schema and callback used by the shared server's account-tool helper.
 *
 * Account selection is request-scoped. For multi-account credentials the explicit
 * `cf-account-id` request header wins over the model-provided `account_id` argument.
 * No selection is retained between MCP calls.
 */
export function buildAccountTool<Shape extends z.ZodRawShape>(
	accountManager: AccountManager,
	request: Request,
	inputSchema: z.ZodObject<Shape>,
	handler: AccountToolCallback<Shape>
): {
	inputSchema: z.ZodObject<z.ZodRawShape>
	callback: ToolCallback<z.ZodObject<z.ZodRawShape>>
} {
	const registeredSchema: z.ZodObject<z.ZodRawShape> = accountManager.requiresAccountSelection
		? inputSchema.extend({ account_id: AccountIdParam })
		: inputSchema

	const callback: ToolCallback<z.ZodObject<z.ZodRawShape>> = async (args, ctx) => {
		const providedAccountId = typeof args.account_id === 'string' ? args.account_id : undefined
		const resolved = accountManager.resolve({
			header: request.headers.get(CF_ACCOUNT_ID_HEADER) ?? undefined,
			providedAccountId,
		})

		if (resolved.error) {
			return resolved.error
		}

		return handler(args as z.output<z.ZodObject<Shape>>, resolved.accountId, ctx)
	}

	return { inputSchema: registeredSchema, callback }
}
