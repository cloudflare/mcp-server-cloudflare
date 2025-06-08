import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'
import {
	BucketListCursorParam,
	BucketListDirectionParam,
	BucketListNameContainsParam,
	BucketListStartAfterParam,
	BucketNameSchema,
} from '../types/r2_bucket.types'
import { PaginationPerPageParam } from '../types/shared.types'

export function registerR2BucketTools(agent: CloudflareMcpAgent) {
	agent.server.tool(
		'r2_buckets_list',
		'List r2 buckets in your Cloudflare account',
		{
			cursor: BucketListCursorParam,
			direction: BucketListDirectionParam,
			name_contains: BucketListNameContainsParam,
			per_page: PaginationPerPageParam,
			start_after: BucketListStartAfterParam,
		},
		async ({ cursor, direction, name_contains, per_page, start_after }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const listResponse = await client.r2.buckets.list({
					account_id,
					cursor: cursor ?? undefined,
					direction: direction ?? undefined,
					name_contains: name_contains ?? undefined,
					per_page: per_page ?? undefined,
					start_after: start_after ?? undefined,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								buckets: listResponse.buckets,
								count: listResponse.buckets?.length ?? 0,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing R2 buckets: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'r2_bucket_create',
		'Create a new r2 bucket in your Cloudflare account',
		{ name: BucketNameSchema },
		async ({ name }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const bucket = await client.r2.buckets.create({
					account_id,
					name,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(bucket),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating KV namespace: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'r2_bucket_get',
		'Get details about a specific R2 bucket',
		{ name: BucketNameSchema },
		async ({ name }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const bucket = await client.r2.buckets.get(name, { account_id })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(bucket),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting R2 bucket: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'r2_bucket_delete',
		'Delete an R2 bucket',
		{ name: BucketNameSchema },
		async ({ name }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const result = await client.r2.buckets.delete(name, { account_id })
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
							text: `Error deleting R2 bucket: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	// Commenting out non-CRUD tools for now to keep the bindings MCP surface small
	// agent.server.tool(
	// 	'r2_bucket_cors_get',
	// 	'Get CORS configuration for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		params: CorsGetParamsSchema.optional(),
	// 	},
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const cors = await client.r2.buckets.cors.get(name, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(cors),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error getting R2 bucket CORS configuration: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_cors_update',
	// 	'Update CORS configuration for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		cors_config: CorsRulesSchema,
	// 	},
	// 	async ({ name, cors_config }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.cors.update(name, {
	// 				account_id,
	// 				...cors_config,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error updating R2 bucket CORS configuration: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_cors_delete',
	// 	'Delete CORS configuration for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		params: CorsDeleteParamsSchema.optional(),
	// 	},
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.cors.delete(name, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error deleting R2 bucket CORS configuration: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_domains_list',
	// 	'List all of the domains for an R2 bucket',
	// 	{ name: BucketNameSchema, params: CustomDomainListParamsSchema.optional() },
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const domains = await client.r2.buckets.domains.custom.list(name, { account_id, ...params })
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(domains),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error listing R2 bucket domains: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_domains_get',
	// 	'Get details about a specific domain for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		domain: CustomDomainNameSchema,
	// 		params: CustomDomainGetParamsSchema.optional(),
	// 	},
	// 	async ({ name, domain, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.domains.custom.get(name, domain, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error getting R2 bucket domain: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_domains_create',
	// 	'Create a new domain for an R2 bucket',
	// 	{ name: BucketNameSchema, params: CustomDomainCreateParamsSchema },
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.domains.custom.create(name, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error creating R2 bucket domain: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_domains_delete',
	// 	'Delete a domain for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		domain: CustomDomainNameSchema,
	// 		params: CustomDomainDeleteParamsSchema.optional(),
	// 	},
	// 	async ({ name, domain, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.domains.custom.delete(name, domain, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error deleting R2 bucket domain: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_domains_update',
	// 	'Update a domain for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		domain: CustomDomainNameSchema,
	// 		params: CustomDomainUpdateParamsSchema,
	// 	},
	// 	async ({ name, domain, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.domains.custom.update(name, domain, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error updating R2 bucket domain: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_event_notifications_get',
	// 	'Get event notifications for an R2 bucket',
	// 	{ name: BucketNameSchema, params: EventNotificationGetParamsSchema.optional() },
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.eventNotifications.get(name, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error getting R2 bucket event notifications: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_event_notifications_update',
	// 	'Update event notifications for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		queueId: QueueIdSchema,
	// 		params: EventNotificationUpdateParamsSchema.optional(),
	// 	},
	// 	async ({ name, queueId, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.eventNotifications.update(name, queueId, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error updating R2 bucket event notifications: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_event_notifications_delete',
	// 	'Delete event notifications for an R2 bucket',
	// 	{
	// 		name: BucketNameSchema,
	// 		queueId: QueueIdSchema,
	// 		params: EventNotificationDeleteParamsSchema.optional(),
	// 	},
	// 	async ({ name, queueId, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.eventNotifications.delete(name, queueId, {
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error deleting R2 bucket event notifications: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_locks_get',
	// 	'Get locks for an R2 bucket',
	// 	{ name: BucketNameSchema, params: LockGetParamsSchema.optional() },
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.locks.get(name, { account_id, ...params })
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error getting R2 bucket locks: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_locks_update',
	// 	'Update locks for an R2 bucket',
	// 	{ name: BucketNameSchema, params: LockUpdateParamsSchema },
	// 	async ({ name, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.locks.update(name, { account_id, ...params })
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error updating R2 bucket locks: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_bucket_temporary_credentials_create',
	// 	'Create temporary credentials for an R2 bucket',
	// 	{ params: TemporaryCredentialsCreateParamsSchema },
	// 	async ({ params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.temporaryCredentials.create({
	// 				account_id,
	// 				...params,
	// 			})
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error creating temporary credentials for R2 bucket: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool('r2_metrics_list', 'List metrics for an R2 bucket', async () => {
	// 	const account_id = await agent.getActiveAccountId()
	// 	if (!account_id) {
	// 		return MISSING_ACCOUNT_ID_RESPONSE
	// 	}
	// 	try {
	// 		const client = getCloudflareClient(agent.props.accessToken)
	// 		const result = await client.r2.buckets.metrics.list({ account_id })
	// 		return {
	// 			content: [
	// 				{
	// 					type: 'text',
	// 					text: JSON.stringify(result),
	// 				},
	// 			],
	// 		}
	// 	} catch (error) {
	// 		return {
	// 			content: [
	// 				{
	// 					type: 'text',
	// 					text: `Error listing R2 bucket metrics: ${error instanceof Error && error.message}`,
	// 				},
	// 			],
	// 		}
	// 	}
	// })

	// agent.server.tool(
	// 	'r2_sippy_get',
	// 	'Get configuration for sippy for an R2 bucket',
	// 	{ bucketName: BucketNameSchema, params: SippyGetParamsSchema.optional() },
	// 	async ({ bucketName, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.sippy.get(bucketName, { account_id, ...params })
	// 			console.log('sippy get result', result)
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result ?? null),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error getting R2 bucket sippy: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_sippy_update',
	// 	'Update configuration for sippy for an R2 bucket',
	// 	{ bucketName: BucketNameSchema, params: SippyUpdateParamsSchema },
	// 	async ({ bucketName, params }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.sippy.update(bucketName, { account_id, ...params })
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error updating R2 bucket sippy: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )

	// agent.server.tool(
	// 	'r2_sippy_delete',
	// 	'Delete sippy for an R2 bucket',
	// 	{ bucketName: BucketNameSchema },
	// 	async ({ bucketName }) => {
	// 		const account_id = await agent.getActiveAccountId()
	// 		if (!account_id) {
	// 			return MISSING_ACCOUNT_ID_RESPONSE
	// 		}
	// 		try {
	// 			const client = getCloudflareClient(agent.props.accessToken)
	// 			const result = await client.r2.buckets.sippy.delete(bucketName, { account_id })
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: JSON.stringify(result),
	// 					},
	// 				],
	// 			}
	// 		} catch (error) {
	// 			return {
	// 				content: [
	// 					{
	// 						type: 'text',
	// 						text: `Error deleting R2 bucket sippy: ${error instanceof Error && error.message}`,
	// 					},
	// 				],
	// 			}
	// 		}
	// 	}
	// )
}
