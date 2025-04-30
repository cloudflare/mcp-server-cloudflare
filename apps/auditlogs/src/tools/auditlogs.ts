import { z } from 'zod'

import { fetchCloudflareApi } from '@repo/mcp-common/src/cloudflare-api'

import type { AuditlogMCP } from '../index'

export const actionResults = z.enum(['success', 'failure', ''])
export const actionTypes = z.enum(['create', 'delete', 'view', 'update'])
export const actorContexts = z.enum(['api_key', 'api_token', 'dash', 'oauth', 'origin_ca_key'])
export const actorTypes = z.enum(['cloudflare_admin', 'account', 'user'])
export const resourceScopes = z.enum(['accounts', 'user', 'zones'])
export const sortDirections = z.enum(['desc', 'asc'])

export const auditLogsQuerySchema = z.object({
	account_name: z.string().optional().describe('The account name to filter audit logs by.'),
	action_result: actionResults.optional().describe('Whether the action was a success or failure.'),
	action_type: actionTypes.optional().describe('The type of action that was performed.'),
	actor_context: actorContexts.optional().describe('The context in which the actor was operating.'),
	actor_email: z
		.string()
		.email()
		.optional()
		.describe('The email of the actor who triggered the event.'),
	actor_id: z.string().optional().describe('The unique identifier of the actor.'),
	actor_ip_address: z.string().optional().describe('The IP address of the actor.'),
	actor_token_id: z.string().optional().describe('The API token ID used by the actor.'),
	actor_token_name: z.string().optional().describe('The name of the API token used by the actor.'),
	actor_type: actorTypes.optional().describe('The type of actor (e.g., user, token).'),
	audit_log_id: z.string().optional().describe('The unique identifier of the audit log entry.'),
	raw_cf_ray_id: z
		.string()
		.optional()
		.describe('The Cloudflare Ray ID associated with the request.'),
	raw_method: z
		.string()
		.optional()
		.describe('The HTTP method used in the request (e.g., GET, POST).'),
	raw_status_code: z.number().optional().describe('The HTTP status code returned by the request.'),
	raw_uri: z.string().optional().describe('The URI accessed in the request.'),
	resource_id: z.string().optional().describe('The unique identifier of the resource affected.'),
	resource_product: z
		.string()
		.optional()
		.describe('The Cloudflare product related to the resource.'),
	resource_type: z.string().optional().describe('The type of resource affected.'),
	resource_scope: resourceScopes
		.optional()
		.describe('The scope of the resource (e.g., account, zone).'),
	zone_id: z.string().optional().describe('The ID of the zone associated with the log.'),
	zone_name: z.string().optional().describe('The name of the zone associated with the log.'),
	since: z
		.string()
		.describe(
			'The start of the time slice to look at. Can be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ'
		)
		.regex(
			/^(\d{4}-\d{2}-\d{2}|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z))$/,
			'Date must be in YYYY-MM-DD or ISO 8601 format with milliseconds (e.g., YYYY-MM-DDTHH:mm:ss.sssZ)'
		),
	before: z
		.string()
		.describe('The end of the time slice to look at. Can be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ')
		.regex(
			/^(\d{4}-\d{2}-\d{2}|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z))$/,
			'Date must be in YYYY-MM-DD or ISO 8601 format with milliseconds (e.g., YYYY-MM-DDTHH:mm:ss.sssZ)'
		),
	direction: sortDirections.optional().describe('The sort direction of the logs (asc or desc).'),
	limit: z
		.number()
		.min(1)
		.max(1000)
		.optional()
		.describe('The number of results to return (max 1000).'),
	cursor: z.string().optional().describe('Pagination cursor for fetching the next set of results.'),
})

// Core schema for one audit log entry
const auditLogEntrySchema = z.object({
	id: z.string().max(36).describe('Unique identifier for the audit log entry'),

	account: z
		.object({
			id: z.string().describe('The ID of the account'),
			name: z.string().describe('The name of the account'),
		})
		.describe('Account information associated with the audit log'),

	action: z
		.object({
			description: z.string().optional().describe('Description of the action taken'),
			result: actionResults.describe('Result of the action'),
			time: z.string().datetime().describe('Timestamp of when the action occurred'),
			type: actionTypes.describe('Type of action performed'),
		})
		.describe('Details of the action performed in the audit log'),

	actor: z
		.object({
			context: actorContexts.optional().describe('Context associated with the actor'),
			email: z.string().email().optional().describe('Email of the actor'),
			id: z.string().optional().describe('ID of the actor'),
			ip_address: z.string().optional().describe('IP address of the actor'),
			type: actorTypes.optional().describe('Type of the actor'),
			token_id: z.string().optional().describe('Token ID if available'),
			token_name: z.string().optional().describe('Token name if available'),
		})
		.optional()
		.describe('Information about the actor who performed the action'),

	resource: z
		.object({
			id: z.string().optional().describe('Resource ID involved in the action'),
			product: z.string().optional().describe('Product related to the action'),
			request: z.record(z.unknown()).optional().describe('Request details of the action'),
			response: z.record(z.unknown()).optional().describe('Response details of the action'),
			scope: z
				.union([z.string(), z.object({})])
				.optional()
				.describe('Scope of the resource, e.g., "accounts"'),
			type: z.string().optional().describe('Type of resource involved'),
		})
		.optional()
		.describe('Details of the resource involved in the action'),

	raw: z
		.object({
			cf_ray_id: z.string().optional().describe('Cloudflare Ray ID associated with the request'),
			method: z.string().optional().describe('HTTP method used for the request'),
			status_code: z.number().optional().describe('HTTP status code of the response'),
			uri: z.string().optional().describe('URI of the request'),
			user_agent: z.string().optional().describe('User-Agent header of the request'),
		})
		.optional()
		.describe('Raw data related to the request made during the action'),

	zone: z
		.object({
			id: z.string().optional().describe('ID of the zone involved in the action'),
			name: z.string().optional().describe('Name of the zone involved in the action'),
		})
		.optional()
		.describe('Zone information related to the action'),
})

// Wrapper schema for response
export const resultInfoSchema = z.object({
	count: z.number(),
	cursor: z.string().optional(),
})

export const auditLogsResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z.array(auditLogEntrySchema).optional(),
	result_info: resultInfoSchema,
})

export const trimmedAuditLog = z.object({
	description: z.string().optional().describe('Description of the action taken'),
	time: z.string().datetime().describe('Timestamp of when the action occurred'),
	product: z.string().optional().describe('Product related to the action'),
	type: z.string().optional().describe('Type of resource involved'),
	actor_email: z.string().email().optional().describe('Email of the actor'),
	actor_token_name: z.string().optional().describe('Token name if available'),
})

export const trimmedAuditLogsResponseSchema = z.object({
	logs: z.array(trimmedAuditLog),
	result_info: resultInfoSchema,
})

export type AuditLogOptions = z.infer<typeof auditLogsQuerySchema>

export async function handleGetAuditLogs(
	accountId: string,
	apiToken: string,
	options: AuditLogOptions
): Promise<z.infer<typeof trimmedAuditLogsResponseSchema>> {
	// Default to just getting the first 10
	if (!options.limit) {
		options.limit = 10
	}

	// Validate and parse query parameters using Zod
	const validatedParams = auditLogsQuerySchema.parse(options)

	// Build query string from validated parameters
	const queryParams = new URLSearchParams()
	for (const [key, value] of Object.entries(validatedParams)) {
		if (value !== undefined && value !== null) {
			queryParams.append(key, String(value)) // Ensure everything is converted to string
		}
	}

	// Call the Public API
	const data = await fetchCloudflareApi({
		endpoint: `/logs/audit?${queryParams.toString()}`,
		accountId,
		apiToken,
		responseSchema: auditLogsResponseSchema,
		options: {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'portal-version': '2',
			},
		},
	})

	// Trim down the results to relevant information
	const results = (data.result || []).map((res) => {
		return {
			description: res.action.description || '',
			time: res.action.time,
			actor_email: res.actor?.email,
			actor_token_name: res.actor?.token_name,
			product: res.resource?.product,
			type: res.resource?.type,
		} as z.infer<typeof trimmedAuditLog>
	})

	return {
		logs: results,
		result_info: data.result_info,
	}
}

/**
 * Registers the audit log tool with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerAuditLogTools(agent: AuditlogMCP) {
	// Register the audit log tool by account
	agent.server.tool(
		'auditlogs_by_account_id',
		`Find all audit logs (a list of who made what change when) for a Cloudflare Account by ID.
		This can be used to query activity on your Cloudflare account at a particular time.
		Since and before are required to look at a slice of time and are dates with or without a time up to millisecond precision e.g YYYY-MM-DDTHH:mm:ss.sssZ.
		There can be more than one page of results and they can be paginated using the returned cursor`,
		auditLogsQuerySchema.shape,
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const result = await handleGetAuditLogs(accountId, agent.props.accessToken, params)
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
							text: JSON.stringify({
								error: `Error reading audit logs: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)
}
