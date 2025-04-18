import { z } from 'zod'

import { handleWorkerLogs, handleWorkerLogsKeys } from '@repo/mcp-common/src/api/workers-logs'

import type { zReturnedQueryRunEvents } from '@repo/mcp-common/src/types/workers-logs-schemas'
import type { ObservabilityMCP } from '../index'

type RelevantLogInfo = z.infer<typeof RelevantLogInfoSchema>
const RelevantLogInfoSchema = z.object({
	timestamp: z.string(),
	path: z.string().nullable(),
	method: z.string().nullable(),
	status: z.number().nullable(),
	outcome: z.string(),
	eventType: z.string(),
	duration: z.number().nullable(),
	error: z.string().nullable(),
	message: z.string().nullable(),
	requestId: z.string(),
	rayId: z.string().nullable(),
	exceptionStack: z.string().nullable(),
})

/**
 * Extracts only the most relevant information from a worker log event ( this is to avoid crashing Claude when returning too much data )
 * @param event z.array(zReturnedTelemetryEvent).optional()
 * @returns Relevant information extracted from the log
 */
function extractRelevantLogInfo(events: zReturnedQueryRunEvents['events'] = []): RelevantLogInfo[] {
	return events.map((event) => {
		const workers = event.$workers
		const metadata = event.$metadata
		const source = event.source

		let path = null
		let method = null
		let status = null
		if (workers?.event?.request) {
			path = workers.event.request.path ?? null
			method = workers.event.request.method ?? null
		}

		if (workers?.event?.response) {
			status = workers.event.response.status ?? null
		}

		let error = null
		if (metadata.error) {
			error = metadata.error
		}

		let message = metadata?.message ?? null
		if (!message) {
			if (workers?.event?.rpcMethod) {
				message = `RPC: ${workers.event.rpcMethod}`
			} else if (path && method) {
				message = `${method} ${path}`
			}
		}

		// Calculate duration
		const duration = (workers?.wallTimeMs || 0) + (workers?.cpuTimeMs || 0)

		// Extract rayId if available
		const rayId = workers?.event?.rayId ?? null

		let exceptionStack = null
		// Extract exception stack if available
		if (typeof source !== 'string') {
			exceptionStack = source?.exception?.stack ?? null
		}

		return {
			timestamp: new Date(event.timestamp).toISOString(),
			path,
			method,
			status,
			outcome: workers?.outcome || 'unknown',
			eventType: workers?.eventType || 'unknown',
			duration: duration || null,
			error,
			message,
			requestId: workers?.requestId || metadata?.id || 'unknown',
			rayId,
			exceptionStack,
		}
	})
}

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
	.max(10080)
	.default(30)
	.describe('Minutes in the past to look for logs (1-10080, default 30)')
const rayIdParam = z.string().optional().describe('Filter logs by specific Cloudflare Ray ID')

/**
 * Registers the logs analysis tool with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerLogsTools(agent: ObservabilityMCP) {
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
				const { logs, from, to } = await handleWorkerLogs({
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
								logs,
								stats: {
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
				const { logs, from, to } = await handleWorkerLogs({
					limit: limitParam,
					minutesAgo: minutesAgoParam,
					accountId,
					apiToken: agent.props.accessToken,
					shouldFilterErrors,
					rayId,
				})
				const events = logs?.events?.events ?? []
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								events: extractRelevantLogInfo(events),
								stats: {
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
									lastSeenAt: key.lastSeenAt ? new Date(key.lastSeenAt).toISOString() : null,
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
