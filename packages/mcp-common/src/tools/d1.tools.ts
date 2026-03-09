import { z } from 'zod'

import { AccountIdParam, resolveAccountId } from './account.helpers'
import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'
import {
	D1DatabaseNameParam,
	D1DatabasePrimaryLocationHintParam,
	D1DatabaseQueryParamsParam,
	D1DatabaseQuerySqlParam,
} from '../types/d1.types'
import { PaginationPageParam, PaginationPerPageParam } from '../types/shared.types'

export function registerD1Tools(agent: CloudflareMcpAgent) {
	agent.server.tool(
		'd1_databases_list',
		'List all of the D1 databases in your Cloudflare account',
		{
			account_id: AccountIdParam,
			name: D1DatabaseNameParam.nullable().optional(),
			page: PaginationPageParam,
			per_page: PaginationPerPageParam,
		},
		{
			title: 'List D1 databases',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ account_id: account_id_param, name, page, per_page }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const account_id = resolved.accountId
			try {
				const props = getProps(agent)
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

	agent.server.tool(
		'd1_database_create',
		'Create a new D1 database in your Cloudflare account',
		{
			account_id: AccountIdParam,
			name: D1DatabaseNameParam,
			primary_location_hint: D1DatabasePrimaryLocationHintParam.nullable().optional(),
		},
		{
			title: 'Create D1 database',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ account_id: account_id_param, name, primary_location_hint }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const account_id = resolved.accountId
			try {
				const props = getProps(agent)
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

	agent.server.tool(
		'd1_database_delete',
		'Delete a d1 database in your Cloudflare account',
		{ account_id: AccountIdParam, database_id: z.string() },
		{
			title: 'Delete D1 database',
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ account_id: account_id_param, database_id }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const account_id = resolved.accountId
			try {
				const props = getProps(agent)
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

	agent.server.tool(
		'd1_database_get',
		'Get a D1 database in your Cloudflare account',
		{ account_id: AccountIdParam, database_id: z.string() },
		{
			title: 'Get D1 database',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ account_id: account_id_param, database_id }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const account_id = resolved.accountId
			try {
				const props = getProps(agent)
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

	agent.server.tool(
		'd1_database_query',
		'Query a D1 database in your Cloudflare account',
		{
			account_id: AccountIdParam,
			database_id: z.string(),
			sql: D1DatabaseQuerySqlParam,
			params: D1DatabaseQueryParamsParam.nullable(),
		},
		{
			title: 'Query D1 database',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ account_id: account_id_param, database_id, sql, params }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const account_id = resolved.accountId
			try {
				const props = getProps(agent)
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
