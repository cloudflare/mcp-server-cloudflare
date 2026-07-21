import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'
import {
	HyperdriveCachingDisabledSchema,
	HyperdriveCachingMaxAgeSchema,
	HyperdriveCachingStaleWhileRevalidateSchema,
	HyperdriveConfigIdSchema,
	HyperdriveConfigNameSchema,
	HyperdriveListParamDirectionSchema,
	HyperdriveListParamOrderSchema,
	HyperdriveListParamPageSchema,
	HyperdriveListParamPerPageSchema,
	HyperdriveOriginDatabaseSchema,
	HyperdriveOriginHostSchema,
	HyperdriveOriginPortSchema,
	HyperdriveOriginSchemeSchema,
	HyperdriveOriginUserSchema,
} from '../types/hyperdrive.types'

import type { McpRegistrationContext } from '../registration-context'

export const HYPERDRIVE_TOOLS = {
	hyperdrive_configs_list: 'hyperdrive_configs_list',
	hyperdrive_config_create: 'hyperdrive_config_create',
	hyperdrive_config_delete: 'hyperdrive_config_delete',
	hyperdrive_config_get: 'hyperdrive_config_get',
	hyperdrive_config_edit: 'hyperdrive_config_edit',
}

/** Registers Hyperdrive tools for one request-scoped server. */
export function registerHyperdriveTools<Env>(context: McpRegistrationContext<Env>) {
	/**
	 * Tool to list Hyperdrive configurations.
	 */
	context.accountTool(
		HYPERDRIVE_TOOLS.hyperdrive_configs_list,
		{
			description: 'List Hyperdrive configurations in your Cloudflare account',
			inputSchema: z.object({
				page: HyperdriveListParamPageSchema.nullable(),
				per_page: HyperdriveListParamPerPageSchema.nullable(),
				order: HyperdriveListParamOrderSchema.nullable(),
				direction: HyperdriveListParamDirectionSchema.nullable(),
			}),
			annotations: {
				title: 'List Hyperdrive configs',
				readOnlyHint: true,
			},
		},
		async ({ page, per_page, order, direction }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const response = await client.hyperdrive.configs.list({
					account_id,
					...(page && { page }),
					...(per_page && { per_page }),
					...(order && { order }),
					...(direction && { direction }),
				})

				const configs = response.result ?? []

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								configs,
								count: configs.length,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing Hyperdrive configs: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to delete a Hyperdrive configuration.
	 */
	context.accountTool(
		HYPERDRIVE_TOOLS.hyperdrive_config_delete,
		{
			description: 'Delete a Hyperdrive configuration in your Cloudflare account',
			inputSchema: z.object({
				hyperdrive_id: HyperdriveConfigIdSchema,
			}),
			annotations: {
				title: 'Delete Hyperdrive config',
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ hyperdrive_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				await client.hyperdrive.configs.delete(hyperdrive_id, { account_id })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, hyperdrive_id: hyperdrive_id }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting Hyperdrive config ${hyperdrive_id}: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to get a specific Hyperdrive configuration.
	 */
	context.accountTool(
		HYPERDRIVE_TOOLS.hyperdrive_config_get,
		{
			description: 'Get details of a specific Hyperdrive configuration in your Cloudflare account',
			inputSchema: z.object({
				hyperdrive_id: HyperdriveConfigIdSchema,
			}),
			annotations: {
				title: 'Get Hyperdrive config',
				readOnlyHint: true,
			},
		},
		async ({ hyperdrive_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const hyperdriveConfig = await client.hyperdrive.configs.get(hyperdrive_id, {
					account_id,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(hyperdriveConfig),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Hyperdrive config ${hyperdrive_id}: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	/**
	 * Tool to edit (PATCH) a Hyperdrive configuration.
	 */
	context.accountTool(
		HYPERDRIVE_TOOLS.hyperdrive_config_edit,
		{
			description: 'Edit (patch) a Hyperdrive configuration in your Cloudflare account',
			inputSchema: z.object({
				hyperdrive_id: HyperdriveConfigIdSchema,
				name: HyperdriveConfigNameSchema.optional().nullable(),
				database: HyperdriveOriginDatabaseSchema.optional().nullable(),
				host: HyperdriveOriginHostSchema.optional().nullable(),
				port: HyperdriveOriginPortSchema.optional().nullable(),
				scheme: HyperdriveOriginSchemeSchema.optional().nullable(),
				user: HyperdriveOriginUserSchema.optional().nullable(),
				caching_disabled: HyperdriveCachingDisabledSchema.optional().nullable(),
				caching_max_age: HyperdriveCachingMaxAgeSchema.optional().nullable(),
				caching_stale_while_revalidate:
					HyperdriveCachingStaleWhileRevalidateSchema.optional().nullable(),
			}),
			annotations: {
				title: 'Edit Hyperdrive config',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async (
			{
				hyperdrive_id,
				name,
				database,
				host,
				port,
				scheme,
				user,
				caching_disabled,
				caching_max_age,
				caching_stale_while_revalidate,
			},
			account_id
		) => {
			try {
				const props = requireRequestProps(context)
				const originPatch: Record<string, any> = {}
				if (database) originPatch.database = database
				if (host) originPatch.host = host
				if (port) originPatch.port = port
				if (scheme) originPatch.scheme = scheme
				if (user) originPatch.user = user

				const cachingPatch: Record<string, any> = {}
				if (caching_disabled) cachingPatch.disabled = caching_disabled
				if (caching_max_age) cachingPatch.max_age = caching_max_age
				if (caching_stale_while_revalidate)
					cachingPatch.stale_while_revalidate = caching_stale_while_revalidate

				const editData: Record<string, any> = {}
				if (name) editData.name = name
				if (Object.keys(originPatch).length > 0) editData.origin = originPatch
				if (Object.keys(cachingPatch).length > 0) editData.caching = cachingPatch

				if (Object.keys(editData).length === 0) {
					return {
						content: [
							{
								type: 'text',
								text: 'Error: No fields provided to edit.',
							},
						],
					}
				}

				const client = getCloudflareClient(props.accessToken)
				const updatedConfig = await client.hyperdrive.configs.edit(hyperdrive_id, {
					account_id,
					...editData,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(updatedConfig),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error editing Hyperdrive config ${hyperdrive_id}: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
