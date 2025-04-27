import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'
import {
	KvNamespaceIdSchema,
	KvNamespacesListParamsSchema,
	KvNamespaceTitleSchema,
} from '../types/kv_namespace'

export function registerKVTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to list KV namespaces.
	 */
	agent.server.tool(
		'kv_namespaces_list',
		'List all of the kv namespaces in your Cloudflare account',
		{ params: KvNamespacesListParamsSchema.optional() },
		async ({ params }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const response = await client.kv.namespaces.list({
					account_id,
					...params,
				})

				const namespaces = response.result ?? []

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								namespaces,
								count: namespaces.length,
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
	 * Tool to create a KV namespace.
	 */
	agent.server.tool(
		'kv_namespace_create',
		'Create a new kv namespace in your Cloudflare account',
		{
			title: KvNamespaceTitleSchema,
		},
		async ({ title }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const namespace = await client.kv.namespaces.create({ account_id, title })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(namespace),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating KV namespace: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to delete a KV namespace.
	 */
	agent.server.tool(
		'kv_namespace_delete',
		'Delete a kv namespace in your Cloudflare account',
		{
			namespace_id: KvNamespaceIdSchema,
		},
		async ({ namespace_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const result = await client.kv.namespaces.delete(namespace_id, { account_id })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result ?? { success: true }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting KV namespace: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to get details of a specific KV namespace.
	 */
	agent.server.tool(
		'kv_namespace_get',
		'Get details of a kv namespace in your Cloudflare account',
		{
			namespace_id: KvNamespaceIdSchema,
		},
		async ({ namespace_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const namespace = await client.kv.namespaces.get(namespace_id, { account_id })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(namespace),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting KV namespace: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to update the title of a KV namespace.
	 */
	agent.server.tool(
		'kv_namespace_update',
		'Update the title of a kv namespace in your Cloudflare account',
		{
			namespace_id: KvNamespaceIdSchema,
			title: KvNamespaceTitleSchema,
		},
		async ({ namespace_id, title }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const result = await client.kv.namespaces.update(namespace_id, {
					account_id,
					title,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result ?? { success: true }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating KV namespace: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
