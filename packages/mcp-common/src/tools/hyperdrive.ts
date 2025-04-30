import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'
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
	HyperdriveOriginPasswordSchema,
	HyperdriveOriginPortSchema,
	HyperdriveOriginSchemeSchema,
	HyperdriveOriginUserSchema,
} from '../types/hyperdrive'

/**
 * Registers Hyperdrive tools with the Cloudflare MCP Agent.
 * @param agent The Cloudflare MCP Agent instance.
 */
export function registerHyperdriveTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to list Hyperdrive configurations.
	 */
	agent.server.tool(
		'hyperdrive_configs_list',
		'List Hyperdrive configurations in your Cloudflare account',
		{
			page: HyperdriveListParamPageSchema.nullable(),
			per_page: HyperdriveListParamPerPageSchema.nullable(),
			order: HyperdriveListParamOrderSchema.nullable(),
			direction: HyperdriveListParamDirectionSchema.nullable(),
		},
		async ({ page, per_page, order, direction }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
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
				}
			}
		}
	)

	/**
	 * Tool to create a Hyperdrive configuration.
	 */
	agent.server.tool(
		'hyperdrive_config_create',
		'Create a new Hyperdrive configuration in your Cloudflare account',
		{
			name: HyperdriveConfigNameSchema,
			database: HyperdriveOriginDatabaseSchema,
			host: HyperdriveOriginHostSchema,
			port: HyperdriveOriginPortSchema,
			scheme: HyperdriveOriginSchemeSchema,
			user: HyperdriveOriginUserSchema,
			password: HyperdriveOriginPasswordSchema,
			caching_disabled: HyperdriveCachingDisabledSchema.nullable(),
			caching_max_age: HyperdriveCachingMaxAgeSchema.nullable(),
			caching_stale_while_revalidate: HyperdriveCachingStaleWhileRevalidateSchema.nullable(),
		},
		async ({
			name,
			database,
			host,
			port,
			scheme,
			user,
			password,
			caching_disabled = undefined,
			caching_max_age = undefined,
			caching_stale_while_revalidate = undefined,
		}) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const origin = { database, host, port, scheme, user, password }
				const caching: Record<string, any> = {}
				if (caching_disabled !== undefined) caching.disabled = caching_disabled
				if (caching_max_age !== undefined) caching.max_age = caching_max_age
				if (caching_stale_while_revalidate !== undefined)
					caching.stale_while_revalidate = caching_stale_while_revalidate

				const client = getCloudflareClient(agent.props.accessToken)
				const hyperdriveConfig = await client.hyperdrive.configs.create({
					account_id,
					name,
					origin,
					...(Object.keys(caching).length > 0 && { caching }),
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
							text: `Error creating Hyperdrive config: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to delete a Hyperdrive configuration.
	 */
	agent.server.tool(
		'hyperdrive_config_delete',
		'Delete a Hyperdrive configuration in your Cloudflare account',
		{
			hyperdrive_id: HyperdriveConfigIdSchema,
		},
		async ({ hyperdrive_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
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
				}
			}
		}
	)

	/**
	 * Tool to get a specific Hyperdrive configuration.
	 */
	agent.server.tool(
		'hyperdrive_config_get',
		'Get details of a specific Hyperdrive configuration in your Cloudflare account',
		{
			hyperdrive_id: HyperdriveConfigIdSchema,
		},
		async ({ hyperdrive_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
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
				}
			}
		}
	)

	/**
	 * Tool to edit (PATCH) a Hyperdrive configuration.
	 */
	agent.server.tool(
		'hyperdrive_config_edit',
		'Edit (patch) a Hyperdrive configuration in your Cloudflare account',
		{
			hyperdrive_id: HyperdriveConfigIdSchema,
			name: HyperdriveConfigNameSchema.optional().nullable(),
			database: HyperdriveOriginDatabaseSchema.optional().nullable(),
			host: HyperdriveOriginHostSchema.optional().nullable(),
			port: HyperdriveOriginPortSchema.optional().nullable(),
			scheme: HyperdriveOriginSchemeSchema.optional().nullable(),
			user: HyperdriveOriginUserSchema.optional().nullable(),
			password: HyperdriveOriginPasswordSchema.optional().nullable(),
			caching_disabled: HyperdriveCachingDisabledSchema.optional().nullable(),
			caching_max_age: HyperdriveCachingMaxAgeSchema.optional().nullable(),
			caching_stale_while_revalidate:
				HyperdriveCachingStaleWhileRevalidateSchema.optional().nullable(),
		},
		async ({
			hyperdrive_id,
			name,
			database,
			host,
			port,
			scheme,
			user,
			password,
			caching_disabled,
			caching_max_age,
			caching_stale_while_revalidate,
		}) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const originPatch: Record<string, any> = {}
				if (database) originPatch.database = database
				if (host) originPatch.host = host
				if (port) originPatch.port = port
				if (scheme) originPatch.scheme = scheme
				if (user) originPatch.user = user
				if (password) originPatch.password = password

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

				const client = getCloudflareClient(agent.props.accessToken)
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
				}
			}
		}
	)

	// Note: client.hyperdrive.configs.update (PUT) was requested but doesn't exist in the SDK.
	// The SDK provides client.hyperdrive.configs.edit (PATCH) which is implemented above.
}
