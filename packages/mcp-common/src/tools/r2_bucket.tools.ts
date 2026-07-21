import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'
import {
	BucketListCursorParam,
	BucketListDirectionParam,
	BucketListNameContainsParam,
	BucketListStartAfterParam,
	BucketNameSchema,
} from '../types/r2_bucket.types'
import { PaginationPerPageParam } from '../types/shared.types'

import type { McpRegistrationContext } from '../registration-context'

export function registerR2BucketTools<Env>(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'r2_buckets_list',
		{
			description: 'List r2 buckets in your Cloudflare account',
			inputSchema: z.object({
				cursor: BucketListCursorParam,
				direction: BucketListDirectionParam,
				name_contains: BucketListNameContainsParam,
				per_page: PaginationPerPageParam,
				start_after: BucketListStartAfterParam,
			}),
			annotations: {
				title: 'List R2 buckets',
				readOnlyHint: true,
			},
		},
		async ({ cursor, direction, name_contains, per_page, start_after }, account_id) => {
			try {
				const props = requireRequestProps(context)
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

	context.accountTool(
		'r2_bucket_create',
		{
			description: 'Create a new r2 bucket in your Cloudflare account',
			inputSchema: z.object({ name: BucketNameSchema }),
			annotations: {
				title: 'Create R2 bucket',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ name }, account_id) => {
			try {
				const props = requireRequestProps(context)
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

	context.accountTool(
		'r2_bucket_get',
		{
			description: 'Get details about a specific R2 bucket',
			inputSchema: z.object({ name: BucketNameSchema }),
			annotations: {
				title: 'Get R2 bucket',
				readOnlyHint: true,
			},
		},
		async ({ name }, account_id) => {
			try {
				const props = requireRequestProps(context)
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

	context.accountTool(
		'r2_bucket_delete',
		{
			description: 'Delete an R2 bucket',
			inputSchema: z.object({ name: BucketNameSchema }),
			annotations: {
				title: 'Delete R2 bucket',
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ name }, account_id) => {
			try {
				const props = requireRequestProps(context)
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
