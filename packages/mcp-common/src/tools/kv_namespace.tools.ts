import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { getProps } from '../get-props'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'
import {
	KvNamespaceIdSchema,
	KvNamespacesListParamsSchema,
	KvNamespaceTitleSchema,
} from '../types/kv_namespace.types'

export const KV_NAMESPACE_TOOLS = {
	kv_namespaces_list: 'kv_namespaces_list',
	kv_namespace_create: 'kv_namespace_create',
	kv_namespace_delete: 'kv_namespace_delete',
	kv_namespace_get: 'kv_namespace_get',
	kv_namespace_update: 'kv_namespace_update',
}

export function registerKVTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to list KV namespaces.
	 */
	agent.server.tool(
		KV_NAMESPACE_TOOLS.kv_namespaces_list,
		`
			List all of the kv namespaces in your Cloudflare account.
			Use this tool when you need to list all of the kv namespaces in your Cloudflare account.
			Returns a list of kv namespaces with the following properties:
			- id: The id of the kv namespace.
			- title: The title of the kv namespace.
			`,
		{ params: KvNamespacesListParamsSchema.optional() },
		{
			title: 'List KV namespaces',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ params }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const response = await client.kv.namespaces.list({
					account_id,
					...params,
				})

				let namespaces = response.result ?? []
				namespaces = namespaces.map((namespace) => ({
					id: namespace.id,
					title: namespace.title,
				}))

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
		KV_NAMESPACE_TOOLS.kv_namespace_create,
		'Create a new kv namespace in your Cloudflare account',
		{
			title: KvNamespaceTitleSchema,
		},
		{
			title: 'Create KV namespace',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ title }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
		KV_NAMESPACE_TOOLS.kv_namespace_delete,
		'Delete a kv namespace in your Cloudflare account',
		{
			namespace_id: KvNamespaceIdSchema,
		},
		{
			title: 'Delete KV namespace',
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ namespace_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
		KV_NAMESPACE_TOOLS.kv_namespace_get,
		`Get details of a kv namespace in your Cloudflare account.
		Use this tool when you need to get details of a specific kv namespace in your Cloudflare account.
		Returns a kv namespace with the following properties:
			- id: The id of the kv namespace.
			- title: The title of the kv namespace.
			- supports_url_encoding: Whether the kv namespace supports url encoding.
			- beta: Whether the kv namespace is in beta.
		`,
		{
			namespace_id: KvNamespaceIdSchema,
		},
		{
			title: 'Get KV namespace',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ namespace_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
		KV_NAMESPACE_TOOLS.kv_namespace_update,
		'Update the title of a kv namespace in your Cloudflare account',
		{
			namespace_id: KvNamespaceIdSchema,
			title: KvNamespaceTitleSchema,
		},
		{
			title: 'Update KV namespace',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ namespace_id, title }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
