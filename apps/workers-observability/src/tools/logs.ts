import { z } from 'zod'

import { handleWorkerLogs, handleWorkerLogsKeys } from '@repo/mcp-common/src/api/logs'

import type { MyMCP } from '../index'

// Worker logs parameter schema
const workerNameParam = z.string().describe('The name of the worker to analyze logs for')
const filterErrorsParam = z.boolean().default(false).describe('If true, only shows error logs')
const limitParam = z
	.number()
	.min(1)
	.max(100)
	.default(100)
	.describe('Maximum number of logs to retrieve (1-100, default 100)')
const minutesAgoParam = z
	.number()
	.min(1)
	.max(1440)
	.default(30)
	.describe('Minutes in the past to look for logs (1-1440, default 30)')
const rayIdParam = z.string().optional().describe('Filter logs by specific Cloudflare Ray ID')

/**
 * Registers the logs analysis tool with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerLogsTools(agent: MyMCP) {
	// Register the worker logs analysis tool by worker name
	agent.server.tool(
		'worker_logs_by_worker_name',
		'Analyze recent logs for a Cloudflare Worker by worker name',
		{
			scriptName: workerNameParam,
			shouldFilterErrors: filterErrorsParam,
			limitParam,
			minutesAgoParam,
			rayId: rayIdParam,
		},
		async (params) => {
			const accountId = agent.getActiveAccountId()
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
				const { scriptName, shouldFilterErrors, limitParam, minutesAgoParam, rayId } = params
				const { relevantLogs, from, to } = await handleWorkerLogs({
					scriptName,
					limit: limitParam,
					minutesAgo: minutesAgoParam,
					accountId,
					apiToken: agent.props.accessToken,
					shouldFilterErrors,
					rayId,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								logs: relevantLogs,
								stats: {
									total: relevantLogs.length,
									timeRange: {
										from,
										to,
									},
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error analyzing worker logs: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)

	// Register tool to search logs by Ray ID across all workers
	agent.server.tool(
		'worker_logs_by_rayid',
		'Analyze recent logs across all workers for a specific request by Cloudflare Ray ID',
		{
			rayId: z.string().describe('Filter logs by specific Cloudflare Ray ID'),
			shouldFilterErrors: filterErrorsParam,
			limitParam,
			minutesAgoParam,
		},
		async (params) => {
			const accountId = agent.getActiveAccountId()
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
				const { rayId, shouldFilterErrors, limitParam, minutesAgoParam } = params
				const { relevantLogs, from, to } = await handleWorkerLogs({
					limit: limitParam,
					minutesAgo: minutesAgoParam,
					accountId,
					apiToken: agent.props.accessToken,
					shouldFilterErrors,
					rayId,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								logs: relevantLogs,
								stats: {
									total: relevantLogs.length,
									timeRange: {
										from,
										to,
									},
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error analyzing logs by Ray ID: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)

	// Register the worker telemetry keys tool
	agent.server.tool(
		'worker_logs_keys',
		'Get available telemetry keys for a Cloudflare Worker',
		{ scriptName: workerNameParam, minutesAgoParam },
		async (params) => {
			const accountId = agent.getActiveAccountId()
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
				const { scriptName, minutesAgoParam } = params
				const keys = await handleWorkerLogsKeys(
					scriptName,
					minutesAgoParam,
					accountId,
					agent.props.accessToken
				)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								keys: keys.map((key) => ({
									key: key.key,
									type: key.type,
									lastSeen: key.lastSeen ? new Date(key.lastSeen).toISOString() : null,
								})),
								stats: {
									total: keys.length,
									byType: keys.reduce(
										(acc, key) => {
											acc[key.type] = (acc[key.type] || 0) + 1
											return acc
										},
										{} as Record<string, number>
									),
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error retrieving worker telemetry keys: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)
}
