import { AccountIdParam, CF_ACCOUNT_ID_HEADER } from './account-manager'

import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from '@modelcontextprotocol/sdk/types.js'
import type { z, ZodRawShape } from 'zod'
import type { AccountManager } from './account-manager'

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

/**
 * Handler for an account-scoped tool. Receives the resolved Cloudflare account id (from the
 * 3-layer {@link AccountManager} resolution) alongside the validated tool arguments and the
 * usual request extra.
 */
export type AccountToolCallback<Shape extends ZodRawShape> = (
	args: z.infer<z.ZodObject<Shape>>,
	accountId: string,
	extra: ToolExtra
) => CallToolResult | Promise<CallToolResult>

/**
 * Pure core of {@link CloudflareMCPServer.accountTool}, kept free of any MCP-server (and thus
 * `ajv`/workerd-bundler) dependency so it is unit-testable in isolation.
 *
 * Returns the input shape to register — with an optional `account_id` parameter appended only
 * when the token spans multiple accounts — and a callback that resolves the account id per call
 * (`cf-account-id` header → `account_id` argument), short-circuiting to an error
 * {@link CallToolResult} when resolution fails (the handler is then never invoked).
 */
export function buildAccountTool<Shape extends ZodRawShape>(
	accountManager: AccountManager,
	shape: Shape,
	handler: AccountToolCallback<Shape>
): {
	shape: ZodRawShape
	callback: ToolCallback<ZodRawShape>
} {
	const registeredShape: ZodRawShape = accountManager.requiresAccountSelection
		? { ...shape, account_id: AccountIdParam }
		: shape

	const callback = (
		args: Record<string, unknown>,
		extra: ToolExtra
	): CallToolResult | Promise<CallToolResult> => {
		const rawHeader = extra.requestInfo?.headers?.[CF_ACCOUNT_ID_HEADER]
		const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
		const providedAccountId = typeof args.account_id === 'string' ? args.account_id : undefined

		const resolved = accountManager.resolve({ header, providedAccountId })
		if (resolved.error) {
			return resolved.error
		}
		return handler(args as z.infer<z.ZodObject<Shape>>, resolved.accountId, extra)
	}

	return { shape: registeredShape, callback }
}
