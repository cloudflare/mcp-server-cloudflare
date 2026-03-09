import { z } from 'zod'

import { getProps } from '../get-props'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

export const AccountIdParam = z
	.string()
	.optional()
	.describe(
		'The Cloudflare account ID to use. Required for user tokens with multiple accounts. Use accounts_list to find your account IDs.'
	)

type ResolveResult = { accountId: string; error?: never } | { accountId?: never; error: CallToolResult }

export function resolveAccountId(agent: CloudflareMcpAgent, providedAccountId?: string): ResolveResult {
	const props = getProps(agent)

	// Account tokens are scoped to a single account — always use it
	if (props.type === 'account_token') {
		return { accountId: props.account.id }
	}

	// User token with explicit account_id — validate it
	if (providedAccountId) {
		const valid = props.accounts.some((a) => a.id === providedAccountId)
		if (!valid) {
			return {
				error: {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: 'Invalid account_id',
								available_accounts: props.accounts.map((a) => ({ id: a.id, name: a.name })),
							}),
						},
					],
					isError: true,
				},
			}
		}
		return { accountId: providedAccountId }
	}

	// Single account — auto-select
	if (props.accounts.length === 1) {
		return { accountId: props.accounts[0].id }
	}

	// Multiple accounts, no account_id provided — error with available accounts
	return {
		error: {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						error: 'account_id is required — you have multiple Cloudflare accounts',
						available_accounts: props.accounts.map((a) => ({ id: a.id, name: a.name })),
					}),
				},
			],
			isError: true,
		},
	}
}
