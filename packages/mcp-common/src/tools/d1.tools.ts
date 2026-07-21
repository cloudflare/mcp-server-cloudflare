import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'
import {
	D1DatabaseNameParam,
	D1DatabasePrimaryLocationHintParam,
	D1DatabaseQueryParamsParam,
	D1DatabaseQuerySqlParam,
} from '../types/d1.types'
import { PaginationPageParam, PaginationPerPageParam } from '../types/shared.types'

import type { McpRegistrationContext } from '../registration-context'

export function registerD1Tools<Env>(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'd1_databases_list',
		{
			description: 'List all of the D1 databases in your Cloudflare account',
			inputSchema: z.object({
				name: D1DatabaseNameParam.nullable().optional(),
				page: PaginationPageParam,
				per_page: PaginationPerPageParam,
			}),
			annotations: {
				title: 'List D1 databases',
				readOnlyHint: true,
			},
		},
		async ({ name, page, per_page }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const listResponse = await client.d1.database.list({
					account_id,
					name: name ?? undefined,
					page: page ?? undefined,
					per_page: per_page ?? undefined,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: listResponse.result,
								result_info: listResponse.result_info,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing D1 databases: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'd1_database_create',
		{
			description: 'Create a new D1 database in your Cloudflare account',
			inputSchema: z.object({
				name: D1DatabaseNameParam,
				primary_location_hint: D1DatabasePrimaryLocationHintParam.nullable().optional(),
			}),
			annotations: {
				title: 'Create D1 database',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ name, primary_location_hint }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const d1Database = await client.d1.database.create({
					account_id,
					name,
					primary_location_hint: primary_location_hint ?? undefined,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(d1Database),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating D1 database: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'd1_database_delete',
		{
			description: 'Delete a d1 database in your Cloudflare account',
			inputSchema: z.object({ database_id: z.string() }),
			annotations: {
				title: 'Delete D1 database',
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ database_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const deleteResponse = await client.d1.database.delete(database_id, {
					account_id,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(deleteResponse),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting D1 database: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'd1_database_get',
		{
			description: 'Get a D1 database in your Cloudflare account',
			inputSchema: z.object({ database_id: z.string() }),
			annotations: {
				title: 'Get D1 database',
				readOnlyHint: true,
			},
		},
		async ({ database_id }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const d1Database = await client.d1.database.get(database_id, {
					account_id,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(d1Database),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting D1 database: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'd1_database_query',
		{
			description: 'Query a D1 database in your Cloudflare account',
			inputSchema: z.object({
				database_id: z.string(),
				sql: D1DatabaseQuerySqlParam,
				params: D1DatabaseQueryParamsParam.nullable(),
			}),
			annotations: {
				title: 'Query D1 database',
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ database_id, sql, params }, account_id) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const queryResult = await client.d1.database.query(database_id, {
					account_id,
					sql,
					params: params ?? undefined,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(queryResult.result),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error querying D1 database: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
