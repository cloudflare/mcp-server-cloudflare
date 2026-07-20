import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'
import {
	KvNamespaceIdSchema,
	KvNamespacesListParamsSchema,
	KvNamespaceTitleSchema,
} from '../types/kv_namespace.types'

import type { McpRegistrationContext } from '../request-context'

export const KV_NAMESPACE_TOOLS = {
	kv_namespaces_list: 'kv_namespaces_list',
	kv_namespace_create: 'kv_namespace_create',
	kv_namespace_delete: 'kv_namespace_delete',
	kv_namespace_get: 'kv_namespace_get',
	kv_namespace_update: 'kv_namespace_update',
}

export function registerKVTools<Env>(context: McpRegistrationContext<Env>) {
	/**
	 * Tool to list KV namespaces.
	 */
	context.server.accountTool(
		KV_NAMESPACE_TOOLS.kv_namespaces_list,
		{
			description: `
			List all of the kv namespaces in your Cloudflare account.
			Use this tool when you need to list all of the kv namespaces in your Cloudflare account.
			Returns a list of kv namespaces with the following properties:
			- id: The id of the kv namespace.
			- title: The title of the kv namespace.
			`,
			inputSchema: z.object({ params: KvNamespacesListParamsSchema.optional() }),
			annotations: {
				title: 'List KV namespaces',
				readOnlyHint: true,
			},
		},
		async ({ params }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to create a KV namespace.
	 */
	context.server.accountTool(
		KV_NAMESPACE_TOOLS.kv_namespace_create,
		{
			description: 'Create a new kv namespace in your Cloudflare account',
			inputSchema: z.object({
				title: KvNamespaceTitleSchema,
			}),
			annotations: {
				title: 'Create KV namespace',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ title }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to delete a KV namespace.
	 */
	context.server.accountTool(
		KV_NAMESPACE_TOOLS.kv_namespace_delete,
		{
			description: 'Delete a kv namespace in your Cloudflare account',
			inputSchema: z.object({
				namespace_id: KvNamespaceIdSchema,
			}),
			annotations: {
				title: 'Delete KV namespace',
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ namespace_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to get details of a specific KV namespace.
	 */
	context.server.accountTool(
		KV_NAMESPACE_TOOLS.kv_namespace_get,
		{
			description: `Get details of a kv namespace in your Cloudflare account.
		Use this tool when you need to get details of a specific kv namespace in your Cloudflare account.
		Returns a kv namespace with the following properties:
			- id: The id of the kv namespace.
			- title: The title of the kv namespace.
			- supports_url_encoding: Whether the kv namespace supports url encoding.
			- beta: Whether the kv namespace is in beta.
		`,
			inputSchema: z.object({
				namespace_id: KvNamespaceIdSchema,
			}),
			annotations: {
				title: 'Get KV namespace',
				readOnlyHint: true,
			},
		},
		async ({ namespace_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to update the title of a KV namespace.
	 */
	context.server.accountTool(
		KV_NAMESPACE_TOOLS.kv_namespace_update,
		{
			description: 'Update the title of a kv namespace in your Cloudflare account',
			inputSchema: z.object({
				namespace_id: KvNamespaceIdSchema,
				title: KvNamespaceTitleSchema,
			}),
			annotations: {
				title: 'Update KV namespace',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ namespace_id, title }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)
}
