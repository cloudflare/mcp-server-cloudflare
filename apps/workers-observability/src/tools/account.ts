import { z } from 'zod'

import { handleAccountsList } from '@repo/mcp-common/src/api/account'
import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'

import type { MyMCP } from '../index'

export function registerAccountTools(agent: MyMCP) {
	// Tool to list all accounts
	agent.server.tool(
		'accounts_list',
		'List all accounts in your Cloudflare account',
		{},
		async () => {
			try {
				const results = await handleAccountsList({
					client: getCloudflareClient(agent.props.accessToken),
				})
				// Sort accounts by created_on date (newest first)
				const accounts = results
					// order by created_on desc ( newest first )
					.sort((a, b) => {
						if (!a.created_on) return 1
						if (!b.created_on) return -1
						return new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
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
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing accounts: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	const activeAccountIdParam = z
		.string()
		.describe(
			'The accountId present in the users Cloudflare account, that should be the active accountId.'
		)
	agent.server.tool(
		'set_active_account',
		'Set active account to be used for tool calls that require accountId',
		{
			activeAccountIdParam,
		},
		async (params) => {
			try {
				const { activeAccountIdParam: activeAccountId } = params
				agent.setActiveAccountId(activeAccountId)
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
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error setting activeAccountID: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
