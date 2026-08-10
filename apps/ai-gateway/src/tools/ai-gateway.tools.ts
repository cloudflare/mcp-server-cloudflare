import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import { GatewayIdParam, ListLogsParams, LogIdParam, pageParam, perPageParam } from '../types'

import type { LogListParams } from 'cloudflare/resources/ai-gateway'
import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'

export function registerAIGatewayTools<Env>(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'list_gateways',
		{
			description: 'List Gateways',
			inputSchema: z.object({
				page: pageParam,
				per_page: perPageParam,
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'list_logs',
		{
			description: 'List Logs',
			inputSchema: z.object(ListLogsParams),
		},
		async (params, accountId) => {
			try {
				const { gateway_id, ...filters } = params

				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'get_log_details',
		{
			description: 'Get a single Log details',
			inputSchema: z.object({
				gateway_id: GatewayIdParam,
				log_id: LogIdParam,
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'get_log_request_body',
		{
			description: 'Get Log Request Body',
			inputSchema: z.object({
				gateway_id: GatewayIdParam,
				log_id: LogIdParam,
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'get_log_response_body',
		{
			description: 'Get Log Response Body',
			inputSchema: z.object({
				gateway_id: GatewayIdParam,
				log_id: LogIdParam,
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)
}
