import { fetchCloudflareApi } from '../cloudflare-api'
import { zKeysResponse, zReturnedQueryRunResult } from '../types/workers-logs-schemas'
import { V4Schema } from '../v4-api'

/**
 * Fetches recent logs for a specified Cloudflare Worker
 * @param scriptName Name of the worker script to get logs for
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 * @returns The logs analysis result with filtered relevant information
 */
export async function handleWorkerLogs({
	limit,
	minutesAgo,
	accountId,
	apiToken,
	shouldFilterErrors,
	scriptName,
	rayId,
}: {
	limit: number
	minutesAgo: number
	accountId: string
	apiToken: string
	shouldFilterErrors: boolean
	scriptName?: string
	rayId?: string
}): Promise<{ logs: zReturnedQueryRunResult | null; from: number; to: number }> {
	if (scriptName === undefined && rayId === undefined) {
		throw new Error('Either scriptName or rayId must be provided')
	}
	// Calculate timeframe based on minutesAgo parameter
	const now = Date.now()
	const fromTimestamp = now - minutesAgo * 60 * 1000

	type QueryFilter = { id: string; key: string; type: string; operation: string; value?: string }
	const filters: QueryFilter[] = []

	// Build query to fetch logs
	if (scriptName) {
		filters.push({
			id: 'worker-name-filter',
			key: '$metadata.service',
			type: 'string',
			value: scriptName,
			operation: 'eq',
		})
	}

	if (shouldFilterErrors === true) {
		filters.push({
			id: 'error-filter',
			key: '$metadata.error',
			type: 'string',
			operation: 'exists',
		})
	}

	// Add Ray ID filter if provided
	if (rayId) {
		filters.push({
			id: 'ray-id-filter',
			key: '$workers.event.rayId',
			type: 'string',
			value: rayId,
			operation: 'eq',
		})
	}

	const queryPayload = {
		queryId: 'workers-logs',
		timeframe: {
			from: fromTimestamp,
			to: now,
		},
		parameters: {
			datasets: ['cloudflare-workers'],
			filters,
			calculations: [],
			groupBys: [],
			havings: [],
		},
		view: 'events',
		limit,
	}

	const data = await fetchCloudflareApi({
		endpoint: '/workers/observability/telemetry/query',
		accountId,
		apiToken,
		responseSchema: V4Schema(zReturnedQueryRunResult),
		options: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(queryPayload),
		},
	})

	return { logs: data.result, from: fromTimestamp, to: now }
}

/**
 * Fetches available telemetry keys for a specified Cloudflare Worker
 * @param scriptName Name of the worker script to get keys for
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 * @returns List of telemetry keys available for the worker
 */
export async function handleWorkerLogsKeys(
	scriptName: string,
	minutesAgo: number,
	accountId: string,
	apiToken: string
): Promise<zKeysResponse> {
	// Calculate timeframe (last 24 hours to ensure we get all keys)
	const now = Date.now()
	const fromTimestamp = now - minutesAgo * 60 * 1000

	// Build query for telemetry keys
	const queryPayload = {
		queryId: 'workers-keys',
		timeframe: {
			from: fromTimestamp,
			to: now,
		},
		parameters: {
			datasets: ['cloudflare-workers'],
			filters: [
				{
					id: 'service-filter',
					key: '$metadata.service',
					type: 'string',
					value: `${scriptName}`,
					operation: 'eq',
				},
			],
		},
	}

	const data = await fetchCloudflareApi({
		endpoint: '/workers/observability/telemetry/keys',
		accountId,
		apiToken,
		responseSchema: V4Schema(zKeysResponse),
		options: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'portal-version': '2',
			},
			body: JSON.stringify(queryPayload),
		},
	})

	return data.result || []
}
