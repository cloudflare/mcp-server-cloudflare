import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'
import { AccountIdParam, resolveAccountId } from '@repo/mcp-common/src/tools/account.helpers'

import { GatewayIdParam, ListLogsParams, LogIdParam, pageParam, perPageParam } from '../types'

import type { LogListParams } from 'cloudflare/resources/ai-gateway'
import type { AIGatewayMCP } from '../ai-gateway.app'

export function registerAIGatewayTools(agent: AIGatewayMCP) {
	agent.server.tool(
		'list_gateways',
		'List Gateways',
		{
			account_id: AccountIdParam,
			page: pageParam,
			per_page: perPageParam,
		},
		async ({ account_id: account_id_param, ...params }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const accountId = resolved.accountId
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

	agent.server.tool('list_logs', 'List Logs', { account_id: AccountIdParam, ...ListLogsParams }, async ({ account_id: account_id_param, ...params }) => {
		const resolved = resolveAccountId(agent, account_id_param)
		if (resolved.error) return resolved.error
		const accountId = resolved.accountId
		try {
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
		'Get a single Log details',
		{
			account_id: AccountIdParam,
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
		async ({ account_id: account_id_param, ...params }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const accountId = resolved.accountId

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
		'Get Log Request Body',
		{
			account_id: AccountIdParam,
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
		async ({ account_id: account_id_param, ...params }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const accountId = resolved.accountId

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
		'Get Log Response Body',
		{
			account_id: AccountIdParam,
			gateway_id: GatewayIdParam,
			log_id: LogIdParam,
		},
		async ({ account_id: account_id_param, ...params }) => {
			const resolved = resolveAccountId(agent, account_id_param)
			if (resolved.error) return resolved.error
			const accountId = resolved.accountId

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
