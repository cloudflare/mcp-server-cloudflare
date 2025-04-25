import { string, z } from 'zod'
import { fetchCloudflareApi, getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'
import {
	StoreIdParam
} from '../types/secrets_store'
import { V4Schema } from '../v4-api'

const account_store = z.object(
	{
		id: z.string(),
		created: z.string(),
		modified: z.string(),
		name: z.string()
	}
)

const account_stores = z.array(account_store)

export function registerStoreTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to list KV namespaces.
	 */
	agent.server.tool(
		'secrets_store_list',
		'List all of the secrets in your Cloudflare account',


		async (params) => {
			const account_id = agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
					const data = await fetchCloudflareApi({
					endpoint: '/secrets_store/stores',
					accountId: account_id,
					apiToken: agent.props.accessToken,
					responseSchema: V4Schema(account_stores),
					options: {
						method: 'GET',
						headers: {
							'Content-Type': 'application/json'
						},
					}, 
				})

				const stores = data.result ?? []

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								stores,
								count: stores.length,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing KV namespaces: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}