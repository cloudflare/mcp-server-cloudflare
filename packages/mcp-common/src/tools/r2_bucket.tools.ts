import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'
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
	agent.server.accountTool(
		'r2_buckets_list',
		'List r2 buckets in your Cloudflare account',
		{
			cursor: BucketListCursorParam,
			direction: BucketListDirectionParam,
			name_contains: BucketListNameContainsParam,
			per_page: PaginationPerPageParam,
			start_after: BucketListStartAfterParam,
		},
		{
			title: 'List R2 buckets',
			readOnlyHint: true,
		},
		async ({ cursor, direction, name_contains, per_page, start_after }, account_id) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'r2_bucket_create',
		'Create a new r2 bucket in your Cloudflare account',
		{ name: BucketNameSchema },
		{
			title: 'Create R2 bucket',
			readOnlyHint: false,
			destructiveHint: false,
		},
		async ({ name }, account_id) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'r2_bucket_get',
		'Get details about a specific R2 bucket',
		{ name: BucketNameSchema },
		{
			title: 'Get R2 bucket',
			readOnlyHint: true,
		},
		async ({ name }, account_id) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'r2_bucket_delete',
		'Delete an R2 bucket',
		{ name: BucketNameSchema },
		{
			title: 'Delete R2 bucket',
			readOnlyHint: false,
			destructiveHint: true,
		},
		async ({ name }, account_id) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
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
					isError: true,
				}
			}
		}
	)
}
