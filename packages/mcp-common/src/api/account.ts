import type { Cloudflare } from 'cloudflare'
import type { Account } from 'cloudflare/resources/accounts/accounts.mjs'
import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'
import type { ToolHandler } from '../types/tools'

export async function handleAccountsList({ client }: { client: Cloudflare }): Promise<Account[]> {
	// Currently limited to 50 accounts
	const response = await client.accounts.list({ query: { per_page: 50 } })
	return response.result
}

export const withAccountCheck = <T extends Record<string, any>>(
	agent: CloudflareMcpAgent,
	handler: ToolHandler<T>
) => {
	return async (params: T) => {
		const accountId = await agent.getActiveAccountId()
		if (!accountId) {
			return {
				content: [
					{
						type: 'text' as const,
						text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
					},
				],
			}
		}

		try {
			const result = await handler({
				...params,
				accountId,
				apiToken: agent.props.accessToken || '',
			})
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(result) }],
			}
		} catch (error) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({
							error: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
						}),
					},
				],
			}
		}
	}
}
