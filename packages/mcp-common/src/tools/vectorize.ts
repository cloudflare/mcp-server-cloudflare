import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import {
	VectorizeIndexConfigSchema,
	VectorizeIndexDescriptionSchema,
	VectorizeIndexNameSchema,
	VectorizeListDirectionParam,
	VectorizeListOrderParam,
	VectorizeListPageParam,
	VectorizeListPerPageParam,
} from '../types/vectorize'

import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'

export const VECTORIZE_TOOLS = {
	vectorize_index_create: 'vectorize_index_create',
	vectorize_index_list: 'vectorize_index_list',
	vectorize_index_get: 'vectorize_index_get',
	vectorize_index_delete: 'vectorize_index_delete',
	vectorize_index_info: 'vectorize_index_info',
}

/**
 * Registers Vectorize Index management tools with the MCP agent.
 * @param agent - The Cloudflare MCP agent instance.
 */
export function registerVectorizeTools(agent: CloudflareMcpAgent) {
	agent.server.tool(
		VECTORIZE_TOOLS.vectorize_index_create,
		'Creates a new Vectorize Index. Use this when a user wants to set up a new vector database.',
		{
			name: VectorizeIndexNameSchema,
			config: VectorizeIndexConfigSchema,
			description: VectorizeIndexDescriptionSchema,
		},
		async (params) => {
			try {
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE
				}
				const client = getCloudflareClient(agent.props.accessToken)

				const result = await client.vectorize.indexes.create({
					account_id,
					name: params.name,
					config: params.config,
					description: params.description === null ? undefined : params.description,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result ?? 'Index created successfully (no detailed response).'),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating Vectorize Index: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		VECTORIZE_TOOLS.vectorize_index_list,
		'Lists Vectorize Indexes in the current account, with optional pagination. Use this when a user asks to see their indexes.',
		{
			page: VectorizeListPageParam,
			per_page: VectorizeListPerPageParam,
			order: VectorizeListOrderParam,
			direction: VectorizeListDirectionParam,
		},
		async ({ page, per_page, order, direction }) => {
			try {
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE
				}
				const client = getCloudflareClient(agent.props.accessToken)

				const response = await client.vectorize.indexes.list(
					{ account_id },
					{
						query: {
							page: page ?? undefined,
							per_page: per_page ?? undefined,
							order: order ?? undefined,
							direction: direction ?? undefined,
						},
					}
				)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing Vectorize Indexes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		VECTORIZE_TOOLS.vectorize_index_get,
		'Retrieves the details and configuration of a specific Vectorize Index by its name.',
		{
			name: VectorizeIndexNameSchema,
		},
		async ({ name }) => {
			try {
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE
				}
				const client = getCloudflareClient(agent.props.accessToken)

				const result = await client.vectorize.indexes.get(name, { account_id })

				if (!result) {
					return {
						content: [
							{
								type: 'text',
								text: `Error: Vectorize Index "${name}" not found.`,
							},
						],
					}
				}
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Vectorize Index "${name}": ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		VECTORIZE_TOOLS.vectorize_index_delete,
		'Deletes a specific Vectorize Index by its name. This action is permanent.',
		{
			name: VectorizeIndexNameSchema,
		},
		async ({ name }) => {
			try {
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE
				}
				const client = getCloudflareClient(agent.props.accessToken)

				await client.vectorize.indexes.delete(name, { account_id })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								success: true,
								message: `Vectorize Index "${name}" deleted successfully.`,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting Vectorize Index "${name}": ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		VECTORIZE_TOOLS.vectorize_index_info,
		'Gets operational information about a Vectorize Index, such as the number of vectors it contains.',
		{
			name: VectorizeIndexNameSchema,
		},
		async ({ name }) => {
			try {
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE
				}
				const client = getCloudflareClient(agent.props.accessToken)

				const result = await client.vectorize.indexes.info(name, { account_id })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result ?? `Could not retrieve info for index "${name}".`),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting info for Vectorize Index "${name}": ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
