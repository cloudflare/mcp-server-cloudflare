import { z } from 'zod'

import { handleAccountsList } from '../api/account.api'
import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'

import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

export function registerAccountTools(agent: CloudflareMcpAgent) {
	// Tool to list all accounts
	agent.server.tool(
		'accounts_list',
		'List all accounts associated with your Cloudflare organization. Use when the user wants to view available accounts before selecting one for operations or switching contexts. Do not use when you need to set which account to use for subsequent operations (use set_active_account instead). Accepts no required parameters but may include optional `page` and `per_page` for pagination. Returns account details such as account ID, name, and type, e.g., personal accounts or enterprise organizations. Raises an error if authentication credentials are invalid or expired.',
		{},
		{
			title: 'List accounts',
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			try {
				const props = getProps(agent)
				const results = await handleAccountsList({
					client: getCloudflareClient(props.accessToken),
				})
				// Sort accounts by created_on date (newest first)
				const accounts = results
					// order by created_on desc ( newest first )
					.sort((a, b) => {
						if (!a.created_on) return 1
						if (!b.created_on) return -1
						return new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
					})
					// Remove fields not needed by the LLM
					.map((account) => {
						return {
							id: account.id,
							name: account.name,
							created_on: account.created_on,
						}
					})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								accounts,
								count: accounts.length,
							}),
						},
					],
				}
			} catch (e) {
				agent.server.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error listing accounts: ${e instanceof Error && e.message}`,
						},
					],
				}
			}
		}
	)

	// Only register set_active_account tool when user token is provided, as it doesn't make sense to expose
	// this tool for account scoped tokens, given that they're scoped to a single account
	if (getProps(agent).type === 'user_token') {
		const activeAccountIdParam = z
			.string()
			.describe(
				'The accountId present in the users Cloudflare account, that should be the active accountId.'
			)
		agent.server.tool(
			'set_active_account',
			'Set the active Cloudflare account to be used for subsequent tool calls that require an account ID. Use when the user wants to switch between multiple Cloudflare accounts or specify which account to operate on. Do not use when you need to see available accounts first (use accounts_list instead). Accepts `account_id` (required string), e.g., "f1234567890abcdef1234567890abcdef". Raises an error if the account ID is invalid or you lack access permissions to that account. "f1234567890abcdef1234567890abcdef". Raises an error if the account ID is invalid or inaccessible with current credentials.',
			{
				activeAccountIdParam,
			},
			{
				title: 'Set active account',
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
				},
			},
			async (params) => {
				try {
					const { activeAccountIdParam: activeAccountId } = params
					await agent.setActiveAccountId(activeAccountId)
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									activeAccountId,
								}),
							},
						],
					}
				} catch (e) {
					agent.server.recordError(e)
					return {
						content: [
							{
								type: 'text',
								text: `Error setting activeAccountID: ${e instanceof Error && e.message}`,
							},
						],
					}
				}
			}
		)
	}
}
