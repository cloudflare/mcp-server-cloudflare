import { z } from 'zod'

import { buildAccountTool } from '@repo/mcp-common/src/account-tool'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AccountManager } from '@repo/mcp-common/src/account-manager'

const WEBSEARCH_API_BASE = 'https://api.cloudflare.com/client/v4/accounts'

const QueryParam = z.string().min(1).describe('The web search query to run.')
// Not range-validated here on purpose — the Web Search API enforces the cap (20).
const MaxResultsParam = z
	.number()
	.int()
	.optional()
	.describe('Maximum number of results to return (up to 20).')

// `account_id` is appended by buildAccountTool only when the credentials span multiple accounts;
// otherwise the account is resolved from auth (cf-account-id header → account_id arg fallback).
export function registerWebSearchTools(
	server: McpServer,
	accountManager: AccountManager,
	accessToken: string
) {
	const { shape, callback } = buildAccountTool(
		accountManager,
		{ query: QueryParam, max_results: MaxResultsParam },
		async ({ query, max_results }, accountId) => {
			try {
				const res = await fetch(`${WEBSEARCH_API_BASE}/${accountId}/websearch/search`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ query, max_results }),
				})

				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}))
					throw new Error(`Web search failed: ${res.status} ${JSON.stringify(errorData)}`)
				}

				const data = await res.json()
				return {
					content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				}
			} catch (error) {
				return {
					isError: true,
					content: [
						{
							type: 'text' as const,
							text: `Error running web search: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	server.registerTool(
		'web_search',
		{
			description:
				'Discover web pages via the Cloudflare Web Search API. Returns a ranked list of links with metadata (title, description, image, and more), not page contents — fetch the links yourself to read them.',
			inputSchema: shape,
			annotations: { readOnlyHint: true },
		},
		callback
	)
}
