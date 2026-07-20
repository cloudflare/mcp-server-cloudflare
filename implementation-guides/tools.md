# MCP Tool Implementation Guide

This guide explains how to implement and register tools within an MCP (Model Context Protocol) server, enabling AI models to interact with external systems, APIs, or Cloudflare services.

## Purpose of Tools

Tools let an MCP client perform actions beyond generating text. They can:

- Interact with APIs.
- Query databases or vector stores.
- Access environment resources such as KV, R2, D1, and service bindings.
- Perform computations or data transformations.

## Request-scoped registration

Every HTTP request creates a fresh SDK v2 server. Tool registrars receive an `McpRegistrationContext` containing that request's server, validated auth props, environment bindings, account manager, request, execution context, `waitUntil`, Sentry client, and metrics.

Register general tools with `context.server.registerTool()`. Register anything that needs a Cloudflare account ID with `context.server.accountTool()`, which resolves the account and passes its ID to the handler.

Account-ID resolution, in priority order:

1. **Auth-pinned account** — an account-scoped API token's account, or an OAuth token with exactly one account. No `account_id` input is exposed.
2. **`cf-account-id` request header** — set in an MCP client configuration for multi-account credentials.
3. **`account_id` tool input** — `accountTool` appends this optional input when credentials span multiple accounts.

If a multi-account request supplies neither a valid header nor input, `accountTool` returns an error and does not invoke the handler. Account selection is never retained between calls.

```typescript
import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'

import type { McpRegistrationContext } from '../request-context'

export function registerMyServiceTools<Env>(context: McpRegistrationContext<Env>) {
	context.server.accountTool(
		'tool_name',
		{
			description: 'Detailed description used by the model to choose this tool.',
			inputSchema: z.object({
				// Do not add account_id. accountTool adds it only when needed.
				param1: z.string(),
				param2: z.number().optional(),
			}),
			annotations: {
				title: 'Human-readable tool title',
				readOnlyHint: true,
			},
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				// const result = await client.someService.someAction({
				//   account_id: accountId,
				//   ...params,
				// })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, accountId, params }),
						},
					],
				}
			} catch (error) {
				context.server.recordError(error)
				return {
					content: [
						{
							type: 'text',
							text: `Error performing action: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.server.registerTool(
		'non_account_tool',
		{
			description: 'A tool that does not need a Cloudflare account ID.',
			inputSchema: z.object({ query: z.string() }),
		},
		async ({ query }) => ({
			content: [{ type: 'text', text: query }],
		})
	)
}
```

## Key components

1. **Name**
   - Use a unique `snake_case` identifier, usually `service_noun_verb`.
2. **Description**
   - State the purpose, when to use the tool, important inputs, and what it returns.
   - Keep it specific and concise; the model uses this text to decide whether to call the tool.
3. **Input schema**
   - Pass a Standard Schema object such as `z.object({...})` as `inputSchema`.
   - Follow [type-validators.md](./type-validators.md).
4. **Handler**
   - Receives validated parameters. `accountTool` also receives the resolved account ID.
   - Read auth from `requireRequestProps(context)` and bindings from `context.env`.
   - Return MCP content blocks and set `isError: true` for handled failures.

## Best practices

- Prefer small, focused tools over monolithic ones.
- Use explicit parameters for every target; do not depend on a previous call or MCP session.
- Treat `context` as request-local and never store it globally.
- Use Zod schemas for input validation.
- Return clear errors and record unexpected failures with `context.server.recordError`.
- Mark read-only or destructive behavior accurately with tool annotations.
- Keep authentication, account selection, and environment bindings request-scoped.
- Preserve genuine application state only where the product requires it; do not use protocol Durable Objects or transport replay state.
