import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { pollUntilReady } from '@repo/mcp-common/src/utils/poll'

import { CreateScanResult, UrlParam } from '../types/url-scanner'

import type { RadarMCP } from '../index'

const MAX_WAIT_SECONDS = 30
const INTERVAL_SECONDS = 2

export function registerUrlScannerTools(agent: RadarMCP) {
	agent.server.tool(
		'scan_url',
		'Submit a URL to scan',
		{
			url: UrlParam,
		},
		async ({ url }) => {
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const account_id = agent.env.ACCOUNT_ID
				const headers = {
					Authorization: `Bearer ${agent.env.URL_SCANNER_API_TOKEN}`,
				}

				// TODO investigate why this does not work
				// const scan = await (client.urlScanner.scans.create({ account_id, url: "https://www.example.com" }, { headers })).withResponse()

				const res = await fetch(
					`https://api.cloudflare.com/client/v4/accounts/${account_id}/urlscanner/v2/scan`,
					{
						method: 'POST',
						headers,
						body: JSON.stringify({ url }),
					}
				)
				if (!res.ok) {
					throw new Error('Failed to submit scan')
				}

				const scan = CreateScanResult.parse(await res.json())
				const scanId = scan?.uuid

				const r = await pollUntilReady({
					taskFn: () => client.urlScanner.scans.get(scanId, { account_id }, { headers }),
					intervalSeconds: INTERVAL_SECONDS,
					maxWaitSeconds: MAX_WAIT_SECONDS,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r, // TODO select what is more relevant, or add a param to allow the agent to select a set of metrics
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error scanning URL: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
