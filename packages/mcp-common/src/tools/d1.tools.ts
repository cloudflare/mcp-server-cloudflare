import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
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
		'List all D1 databases in your Cloudflare account. Use when the user wants to view, browse, or inventory their existing D1 databases across the account. Do not use when you need details about a specific database (use d1_database_get instead) or want to create a new database (use d1_database_create instead). Accepts `account_id` (optional, uses active account if not specified). e.g., returns database names, IDs, and creation timestamps for all databases. Raises an error if no active account is set or if authentication fails.',
		{
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
		async ({ name, page, per_page }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
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
				}
			}
		}
	)

	agent.server.tool(
		'd1_database_create',
		'Create a new D1 database in your Cloudflare account. Use when the user wants to set up a new SQLite-compatible database for their applications or projects. Do not use when you need to view existing databases (use d1_databases_list instead) or query an existing database (use d1_database_query instead). Accepts `name` (required, string) for the database identifier, e.g., "my-app-db" or "production-data". Raises an error if the database name already exists or contains invalid characters. "my-app-db" or "production-users". Raises an error if a database with the same name already exists or if the account lacks D1 creation permissions.',
		{
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
		async ({ name, primary_location_hint }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
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
				}
			}
		}
	)

	agent.server.tool(
		'd1_database_delete',
		'Delete a D1 database from your Cloudflare account permanently. Use when the user wants to remove an existing database that is no longer needed or should be cleaned up. Do not use when you need to create a new database (use d1_database_create instead) or query an existing one (use d1_database_query instead). Accepts `database_id` (required) or `database_name` (required), e.g., database_id="abc123-def456-ghi789". Raises an error if the database does not exist or you lack deletion permissions."abc123-def456" or database_name="my-production-db". Raises an error if the database does not exist or if you lack deletion permissions for the specified database.',
		{ database_id: z.string() },
		{
			title: 'Delete D1 database',
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ database_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
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
				}
			}
		}
	)

	agent.server.tool(
		'd1_database_get',
		'Get details and metadata for a specific D1 database in your Cloudflare account. Use when the user wants to inspect configuration, connection details, or properties of an existing database. Do not use when you need to see all databases (use d1_databases_list instead) or query database contents (use d1_database_query instead). Accepts `database_id` or `database_name` (required), e.g., "my-production-db" or "abc123-def456-ghi789". Raises an error if the database does not exist or you lack access permissions. "my-production-db" or "abc123-def456-ghi789". Raises an error if the database does not exist or you lack permissions to access it.',
		{ database_id: z.string() },
		{
			title: 'Get D1 database',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ database_id }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
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
				}
			}
		}
	)

	agent.server.tool(
		'd1_database_query',
		'Query a D1 database in your Cloudflare account to execute SQL statements and retrieve data. Use when the user wants to run SELECT queries, analyze data, or inspect database contents with custom SQL. Do not use when you need to list available databases (use d1_databases_list instead) or create a new database (use d1_database_create instead). Accepts `database_id` (required), `sql` (required SQL statement), and `account_id` (optional). e.g., sql="SELECT * FROM users WHERE active = 1". Raises an error if the database ID is invalid or the SQL query contains syntax errors."SELECT * FROM users WHERE active = 1 LIMIT 10". Raises an error if the database does not exist or the SQL query contains syntax errors.',
		{
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
		async ({ database_id, sql, params }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
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
				}
			}
		}
	)
}
