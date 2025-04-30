import { z } from 'zod'

import { fetchCloudflareApi } from '@repo/mcp-common/src/cloudflare-api'

import type { LogsMCP } from '../index'

const zJobIdentifier = z.number().int().min(1).optional().describe('Unique id of the job.')
const zEnabled = z.boolean().optional().describe('Flag that indicates if the job is enabled.')
const zName = z
	.string()
	.regex(/^[a-zA-Z0-9\-.]*$/)
	.max(512)
	.nullable()
	.optional()
	.describe('Optional human readable job name. Not unique.')
const zDataset = z
	.string()
	.regex(/^[a-zA-Z0-9_-]*$/)
	.max(256)
	.nullable()
	.optional()
	.describe('Name of the dataset.')
const zLastComplete = z
	.string()
	.datetime()
	.nullable()
	.optional()
	.describe('Records the last time for which logs have been successfully pushed.')
const zLastError = z
	.string()
	.datetime()
	.nullable()
	.optional()
	.describe('Records the last time the job failed.')
const zErrorMessage = z
	.string()
	.nullable()
	.optional()
	.describe('If not null, the job is currently failing.')

export const zLogpushJob = z
	.object({
		id: zJobIdentifier,
		enabled: zEnabled,
		name: zName,
		dataset: zDataset,
		last_complete: zLastComplete,
		last_error: zLastError,
		error_message: zErrorMessage,
	})
	.nullable()
	.optional()

const zApiResponseCommon = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
})

const zLogPushJobResults = z.array(zLogpushJob).optional()

// The complete schema for zone_logpush_job_response_collection
export const zLogpushJobResponseCollection = zApiResponseCommon.extend({
	result: zLogPushJobResults,
})

/**
 * Fetches available telemetry keys for a specified Cloudflare Worker
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 * @returns List of telemetry keys available for the worker
 */

export async function handleGetAccountLogPushJobs(
	accountId: string,
	apiToken: string
): Promise<z.infer<typeof zLogPushJobResults>> {
	// Call the Public API
	const data = await fetchCloudflareApi({
		endpoint: `/logpush/jobs`,
		accountId,
		apiToken,
		responseSchema: zLogpushJobResponseCollection,
		options: {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'portal-version': '2',
			},
		},
	})

	const res = data as z.infer<typeof zLogpushJobResponseCollection>
	return (res.result ?? []).slice(0, 100)
}

/**
 * Registers the logs analysis tool with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerLogsTools(agent: LogsMCP) {
	// Register the worker logs analysis tool by worker name
	agent.server.tool(
		'logpush_jobs_by_account_id',
		`All Logpush jobs by Account ID.
		
		You should use this tool when:
		- You have questions or wish to request information about their Cloudflare Logpush jobs by account
		- You want a condensed version for the output results of your account's Cloudflare Logpush job

		This tool returns at most the first 100 jobs.
		`,
		{},
		async () => {
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
				const result = await handleGetAccountLogPushJobs(accountId, agent.props.accessToken)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result,
							}),
						},
					],
				}
			} catch (e) {
				agent.server.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error analyzing logpush jobs: ${e instanceof Error && e.message}`,
							}),
						},
					],
				}
			}
		}
	)
}
