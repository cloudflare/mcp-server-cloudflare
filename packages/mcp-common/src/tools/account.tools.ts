import { handleAccountsList } from '../api/account.api'
import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'

import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

export function registerAccountTools(agent: CloudflareMcpAgent) {
	// Tool to list all accounts
	agent.server.tool(
		'accounts_list',
		'List all accounts in your Cloudflare account',
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
}
