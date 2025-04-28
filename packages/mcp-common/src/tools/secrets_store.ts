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

const secret = z.object({
    name: z.string(),
    comment: z.string().nullable(),
	created: z.string(),
	modified: z.string(),
	status: z.string()
})

const secrets = z.array(secret)

export function registerStoreTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to list stores in an account.
	 */
	agent.server.tool(
		'secrets_store_list_stores',
		'List the Secret Store in your Cloudflare account',


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
	 /**
     * Tool to get secrets within a specific Secret Store.
     */
	 agent.server.tool(
        'secrets_store_get_secrets',
        'Get the secrets in a specific Secret Store',
        {
            store_id: StoreIdParam
        },
        async (params) => {
            const { store_id } = params
            if (!store_id) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Missing required parameter: store_id',
                        },
                    ],
                }
            }

            const account_id = agent.getActiveAccountId()
            if (!account_id) {
                return MISSING_ACCOUNT_ID_RESPONSE
            }
            
            try {
                const data = await fetchCloudflareApi({
                    endpoint: `/secrets_store/stores/${store_id}/secrets`,
                    accountId: account_id,
                    apiToken: agent.props.accessToken,
                    responseSchema: V4Schema(secrets),
                    options: {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                    }, 
                })

                const storeSecrets = data.result ?? []

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                secrets: storeSecrets,
                                count: storeSecrets.length,
                            }),
                        },
                    ],
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error getting secrets from store: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                }
            }
        }
    )
}


