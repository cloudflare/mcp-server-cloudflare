import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import { GatewayIdParam, ListLogsParams, LogIdParam, pageParam, perPageParam } from '../types'

import type { LogListParams } from 'cloudflare/resources/ai-gateway'
import type { AIGatewayMCP } from '../ai-gateway.app'

export function registerAIGatewayTools(agent: AIGatewayMCP) {
	agent.server.tool(
		'list_gateways',
		'List all Cloudflare Magic WAN gateways in your account. Use when the user wants to view, inspect, or manage network gateway configurations for Magic WAN connectivity. Accepts `account_id` (optional, uses active account if not specified). e.g., retrieving gateway details for network troubleshooting or configuration review. Do not use when you need to list other Cloudflare services like D1 databases or R2 buckets (use their respective list tools instead). Returns an error if the account lacks Magic WAN entitlements or API permissions.',
		{
			page: pageParam,
			per_page: perPageParam,
		},
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
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.aiGateway.list({
					account_id: accountId,
					page: params.page,
					per_page: params.per_page,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.result,
								result_info: r.result_info,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing gateways: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool('list_logs', 'List logs from Cloudflare services and applications in your account. Use when the user wants to review, monitor, or troubleshoot system events, errors, or activity across Cloudflare products. Do not use when you need to query structured data from D1 databases (use d1_database_query instead). Accepts `service` (optional, specifies which Cloudflare service), `limit` (optional, number of entries), and `start_time` (optional, timestamp filter). e.g., service="workers", limit=100. Raises an error if the specified service does not exist or if you lack permissions to access the logs.', ListLogsParams, async (params) => {
		try {
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

			const { gateway_id, ...filters } = params

			const props = getProps(agent)
			const client = getCloudflareClient(props.accessToken)
			const r = await client.aiGateway.logs.list(gateway_id, {
				...filters,
				account_id: accountId,
			} as LogListParams)

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							result: r.result,
							result_info: r.result_info,
						}),
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error listing logs: ${error instanceof Error && error.message}`,
					},
				],
			}
		}
	})

	agent.server.tool(
		'get_log_details',
		'Retrieve detailed information for a specific log entry from your Cloudflare account. Use when the user wants to examine the full details, metadata, or properties of an individual log record. Do not use when you need to search or list multiple logs (use search tools instead). Accepts `log_id` (required) to identify the specific log entry, e.g., log_id="abc123-def456-ghi789". Raises an error if the log ID does not exist or access is denied."abc123-def456-ghi789". Returns error if the log ID does not exist or access is denied. Do not use when you need to search or filter multiple logs (use appropriate search tools instead).',
		{
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
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
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.aiGateway.logs.get(params.gateway_id, params.log_id, {
					account_id: accountId,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting log: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_log_request_body',
		'Retrieve the body content of a specific log request entry. Use when the user wants to examine the detailed payload or content data from a logged request for debugging or analysis purposes. Accepts `request_id` (required) and `format` (optional). e.g., request_id="abc123", format="json". Raises an error if the request_id does not exist or the log entry has no body content. Do not use when you need to search or list multiple log entries (use appropriate search tools instead)."12345", format="json". Do not use when you need to list multiple log entries (use a log listing tool instead). Raises an error if the request ID does not exist or is inaccessible.',
		{
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
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
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.aiGateway.logs.request(params.gateway_id, params.log_id, {
					account_id: accountId,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting log request body: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_log_response_body',
		'Retrieve the response body content from Cloudflare logs for detailed inspection and debugging. Use when the user wants to examine the actual HTTP response data, payload content, or troubleshoot API responses from logged requests. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `log_id` (required) and `response_format` (optional). e.g., log_id="abc123def456". Raises an error if the log ID does not exist or access is denied."abc123def456" with response_format="json". Do not use when you need to view request headers or metadata (use other log inspection tools instead). Raises an error if the log entry does not exist or access permissions are insufficient.',
		{
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
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
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.aiGateway.logs.response(params.gateway_id, params.log_id, {
					account_id: accountId,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting log response body: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
