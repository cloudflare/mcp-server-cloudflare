import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { pollUntilReady } from '@repo/mcp-common/src/poll'

import { CreateScanResult, UrlParam } from '../types/url-scanner'

import type { RadarMCP } from '../radar.app'

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
				const client = getCloudflareClient(agent.props.accessToken)

				// Search if there are recent scans for the URL
				const scans = await client.urlScanner.scans.list({
					account_id: accountId,
					q: `page.url:"${url}"`,
				})

				let scanId = scans.results.length > 0 ? scans.results[0]._id : null

				if (!scanId) {
					// Submit scan
					// TODO theres an issue (reported) with this method in the cloudflare TS lib
					// const scan = await (client.urlScanner.scans.create({ account_id, url: "https://www.example.com" }, { headers })).withResponse()

					const res = await fetch(
						`https://api.cloudflare.com/client/v4/accounts/${accountId}/urlscanner/v2/scan`,
						{
							method: 'POST',
							headers: {
								Authorization: `Bearer ${agent.props.accessToken}`,
							},
							body: JSON.stringify({ url }),
						}
					)

					if (!res.ok) {
						throw new Error('Failed to submit scan')
					}

					const scan = CreateScanResult.parse(await res.json())
					scanId = scan?.uuid
				}

				const r = await pollUntilReady({
					taskFn: () => client.urlScanner.scans.get(scanId, { account_id: accountId }),
					intervalSeconds: INTERVAL_SECONDS,
					maxWaitSeconds: MAX_WAIT_SECONDS,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: { verdicts: r.verdicts, stats: r.stats, page: r.page }, // TODO select what is more relevant, or add a param to allow the agent to select a set of metrics
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
