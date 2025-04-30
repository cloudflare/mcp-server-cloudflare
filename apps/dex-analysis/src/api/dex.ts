import { fetchCloudflareApi } from '@repo/mcp-common/src/cloudflare-api'

export const fetchDexTestAnalyzation = async ({
	dexTestId,
	accountId,
	accessToken,
	timeStart,
	timeEnd,
}: {
	dexTestId: string
	accountId: string
	accessToken: string
	timeStart: string
	timeEnd: string
}) => {
	return await fetchCloudflareApi({
		endpoint: `/dex/test-results/by-quartile?from=${timeStart}&to=${timeEnd}&limit=4&testId=${dexTestId}`,
		accountId,
		apiToken: accessToken,
		options: {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	})
}

export const fetchDexTests = async ({
	accountId,
	accessToken,
}: {
	accountId: string
	accessToken: string
}) => {
	return await fetchCloudflareApi({
		endpoint: '/dex/tests/overview?per_page=50',
		accountId,
		apiToken: accessToken,
		options: {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	})
}
