import { fetchCloudflareApi } from '../cloudflare-api'
import {
	zKeysResponse,
	zReturnedQueryRunResult,
	zValuesResponse,
} from '../types/workers-logs-schemas'
import { V4Schema } from '../v4-api'

import type { z } from 'zod'
import type { zKeysRequest, zQueryRunRequest, zValuesRequest } from '../types/workers-logs-schemas'

type QueryRunRequest = z.infer<typeof zQueryRunRequest>

function fixTimeframe(timeframe: QueryRunRequest['timeframe']) {
	return {
		from: new Date(timeframe.from).getTime(),
		to: new Date(timeframe.to).getTime(),
	}
}

export async function queryWorkersObservability(
	apiToken: string,
	accountId: string,
	query: QueryRunRequest
): Promise<z.infer<typeof zReturnedQueryRunResult> | null> {
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
			body: JSON.stringify({ ...query, timeframe: fixTimeframe(query.timeframe) }),
		},
	})

	return data.result
}

type QueryKeysRequest = z.infer<typeof zKeysRequest>
export async function handleWorkerLogsKeys(
	apiToken: string,
	accountId: string,
	keysQuery: QueryKeysRequest
): Promise<zKeysResponse> {
	const data = await fetchCloudflareApi({
		endpoint: '/workers/observability/telemetry/keys',
		accountId,
		apiToken,
		responseSchema: V4Schema(zKeysResponse),
		options: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...keysQuery, timeframe: fixTimeframe(keysQuery.timeframe) }),
		},
	})

	return data.result || []
}

export async function handleWorkerLogsValues(
	apiToken: string,
	accountId: string,
	valuesQuery: z.infer<typeof zValuesRequest>
): Promise<z.infer<typeof zValuesResponse> | null> {
	const data = await fetchCloudflareApi({
		endpoint: '/workers/observability/telemetry/values',
		accountId,
		apiToken,
		responseSchema: V4Schema(zValuesResponse),
		options: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...valuesQuery, timeframe: fixTimeframe(valuesQuery.timeframe) }),
		},
	})

	return data.result
}
