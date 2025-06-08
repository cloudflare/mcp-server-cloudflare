import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'

import { GatewayIdParam, ListLogsParams, LogIdParam, pageParam, perPageParam } from '../types'

import type { LogListParams } from 'cloudflare/resources/ai-gateway'
import type { AIGatewayMCP } from '../ai-gateway.app'

export function registerAIGatewayTools(agent: AIGatewayMCP) {
	agent.server.tool(
		'list_gateways',
		'List Gateways',
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
				const client = getCloudflareClient(agent.props.accessToken)
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

	agent.server.tool('list_logs', 'List Logs', ListLogsParams, async (params) => {
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

			const client = getCloudflareClient(agent.props.accessToken)
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
		'Get a single Log details',
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
				const client = getCloudflareClient(agent.props.accessToken)
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
		'Get Log Request Body',
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
				const client = getCloudflareClient(agent.props.accessToken)
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
		'Get Log Response Body',
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
				const client = getCloudflareClient(agent.props.accessToken)
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
