import { fetchCloudflareApi } from '../cloudflare-api'
import {
	GetBuildLogsResult,
	GetBuildResult,
	ListBuildsByScriptResult,
	ListBuildsByScriptResultInfo,
} from '../types/workers-builds.types'
import { V4Schema } from '../v4-api'

import type { LogLine } from '../types/workers-builds.types'

export async function listBuilds({
	accountId,
	workerId,
	page = 1,
	perPage = 10,
	apiToken,
}: {
	accountId: string
	workerId: string
	page?: number
	perPage?: number
	apiToken: string
}) {
	return fetchCloudflareApi({
		endpoint: `/builds/workers/${workerId}/builds?page=${page}&per_page=${perPage}`,
		accountId,
		apiToken,
		responseSchema: V4Schema(ListBuildsByScriptResult, ListBuildsByScriptResultInfo),
	})
}

export async function getBuild({
	accountId,
	buildUUID,
	apiToken,
}: {
	accountId: string
	buildUUID: string
	apiToken: string
}) {
	return fetchCloudflareApi({
		endpoint: `/builds/builds/${buildUUID}`,
		accountId,
		apiToken,
		responseSchema: V4Schema(GetBuildResult),
	})
}

export async function getBuildLogs({
	accountId,
	buildUUID,
	apiToken,
}: {
	accountId: string
	buildUUID: string
	apiToken: string
}) {
	const allLogs: LogLine[] = []
	let cursor: string | undefined = undefined
	let hasMore = true

	while (hasMore) {
		let endpoint = `/builds/builds/${buildUUID}/logs`
		if (cursor) {
			endpoint += `?cursor=${cursor}`
		}

		const res = await fetchCloudflareApi({
			endpoint,
			accountId,
			apiToken,
			responseSchema: V4Schema(GetBuildLogsResult),
		})

		if (res.result) {
			allLogs.push(...res.result.lines)

			if (res.result.cursor && res.result.truncated) {
				cursor = res.result.cursor
			} else {
				hasMore = false
			}
		}
	}

	return allLogs
}
