import { getProps } from '../get-props'
import { resolveAccountId } from '../tools/account.helpers'

import type { Cloudflare } from 'cloudflare'
import type { Account } from 'cloudflare/resources/accounts/accounts.mjs'
import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'
import type { ToolHandler } from '../types/tools.types'

export async function handleAccountsList({ client }: { client: Cloudflare }): Promise<Account[]> {
	// Currently limited to 50 accounts
	const response = await client.accounts.list({ query: { per_page: 50 } })
	return response.result
}

export const withAccountCheck = <T extends Record<string, any>>(
	agent: CloudflareMcpAgent,
	handler: ToolHandler<T>
) => {
	return async (params: T & { account_id?: string }) => {
		const resolved = resolveAccountId(agent, params.account_id)
		if (resolved.error) return resolved.error

		try {
			const props = getProps(agent)
			const result = await handler({
				...params,
				accountId: resolved.accountId,
				apiToken: props.accessToken || '',
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
