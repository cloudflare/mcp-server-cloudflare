import { z } from 'zod'

import { getProps } from '@repo/mcp-common/src/get-props'

import {
	CreateScanResult,
	ScanIdParam,
	ScanVisibilityParam,
	ScreenshotResolutionParam,
	SearchQueryParam,
	SearchSizeParam,
	UrlParam,
} from '../types/url-scanner'

import type { RadarMCP } from '../radar.app'

const URLSCANNER_API_BASE = 'https://api.cloudflare.com/client/v4/accounts'

type ToolResponse = {
	content: Array<{ type: 'text'; text: string }>
}

/**
 * Helper to get account ID or return error response
 */
async function getAccountIdOrError(
	agent: RadarMCP
): Promise<{ accountId: string } | { error: ToolResponse }> {
	const accountId = await agent.getActiveAccountId()
	if (!accountId) {
		return {
			error: {
				content: [
					{
						type: 'text' as const,
						text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
					},
				],
			},
		}
	}
	return { accountId }
}

export function registerUrlScannerTools(agent: RadarMCP) {
	// Search URL scans
	agent.server.tool(
		'search_url_scans',
		"Search URL scans using ElasticSearch-like query syntax to find matching scan results. Use when the user wants to filter, find, or analyze URL scan data based on specific criteria like domains, status codes, or scan metadata. Do not use when you need to search Cloudflare documentation or configuration details (use search_cloudflare_documentation instead). Accepts `query` (required ElasticSearch syntax string) and optional filtering parameters, e.g., "domain:example.com AND status:200" or "scan_date:[2024-01-01 TO 2024-12-31]". Raises an error if the query syntax is invalid or the scan database is unavailable. "domain:example.com AND status:200" or "scan_date:[2024-01-01 TO 2024-12-31]". Do not use when you need to search Cloudflare documentation or configuration details (use search_cloudflare_documentation instead). Returns an error if the query syntax is malformed or the search service is unavailable. 'page.domain:example.com', 'verdicts.malicious:true', 'page.asn:AS24940 AND hash:xxx', 'apikey:me AND date:[2025-01 TO 2025-02]'",
		{
			query: SearchQueryParam,
			size: SearchSizeParam,
		},
		async ({ query, size }) => {
			const result = await getAccountIdOrError(agent)
			if ('error' in result) return result.error

			try {
				const props = getProps(agent)
				const url = new URL(`${URLSCANNER_API_BASE}/${result.accountId}/urlscanner/v2/search`)
				if (query) url.searchParams.set('q', query)
				if (size) url.searchParams.set('size', String(size))

				const res = await fetch(url.toString(), {
					headers: { Authorization: `Bearer ${props.accessToken}` },
				})

				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}))
					throw new Error(`Search failed: ${res.status} ${JSON.stringify(errorData)}`)
				}

				const data = await res.json()
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(data),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error searching scans: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Create URL scan
	agent.server.tool(
		'create_url_scan',
		'Submit a URL for security scanning and malware detection. Use when the user wants to analyze a website or URL for threats, vulnerabilities, or suspicious content before visiting or sharing it. Accepts `url` (required string), e.g., "https://example.com" or "http://suspicious-site.net". Do not use when you need to search Cloudflare documentation or manage Cloudflare services (use search_cloudflare_documentation or other Cloudflare tools instead). Raises an error if the URL format is invalid or the scanning service is temporarily unavailable. "https://example.com" or "http://suspicious-site.net". Returns a scan UUID that can be used to retrieve detailed results once the scan completes. Raises an error if the URL format is invalid or the scanning service is unavailable. Do not use when you need to search Cloudflare documentation about URL scanning (use search_cloudflare_documentation instead).',
		{
			url: UrlParam,
			visibility: ScanVisibilityParam,
			screenshotResolution: ScreenshotResolutionParam,
		},
		async ({ url, visibility, screenshotResolution }) => {
			const result = await getAccountIdOrError(agent)
			if ('error' in result) return result.error

			try {
				const props = getProps(agent)

				const body: Record<string, unknown> = { url }
				if (visibility) body.visibility = visibility
				if (screenshotResolution) body.screenshotsResolutions = [screenshotResolution]

				const res = await fetch(`${URLSCANNER_API_BASE}/${result.accountId}/urlscanner/v2/scan`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${props.accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				})

				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}))
					throw new Error(`Scan submission failed: ${res.status} ${JSON.stringify(errorData)}`)
				}

				const scan = CreateScanResult.parse(await res.json())
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								message: 'Scan submitted successfully',
								scanId: scan.uuid,
								url,
								visibility: visibility || 'Public',
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error creating scan: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Get URL scan result
	agent.server.tool(
		'get_url_scan',
		'Retrieve the results of a URL scan by its UUID and return detailed security analysis including verdicts, page info, requests, and cookies. Use when the user wants to examine or review the findings from a previously initiated URL security scan. Do not use when you need to start a new scan (use a URL scanning tool instead). Accepts `uuid` (required string) identifying the specific scan, e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890". Raises an error if the UUID is invalid or the scan results are not yet available. "a1b2c3d4-e5f6-7890-abcd-ef1234567890". Returns error if the UUID is invalid or the scan is still in progress.',
		{
			scanId: ScanIdParam,
		},
		async ({ scanId }) => {
			const result = await getAccountIdOrError(agent)
			if ('error' in result) return result.error

			try {
				const props = getProps(agent)

				const res = await fetch(
					`${URLSCANNER_API_BASE}/${result.accountId}/urlscanner/v2/result/${scanId}`,
					{
						headers: { Authorization: `Bearer ${props.accessToken}` },
					}
				)

				if (!res.ok) {
					if (res.status === 404) {
						throw new Error('Scan not found or still in progress')
					}
					const errorData = await res.json().catch(() => ({}))
					throw new Error(`Failed to get scan: ${res.status} ${JSON.stringify(errorData)}`)
				}

				const data = (await res.json()) as {
					verdicts?: unknown
					page?: unknown
					stats?: unknown
					lists?: unknown
				}
				// Return a summary of the most useful fields
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								verdicts: data.verdicts,
								page: data.page,
								stats: data.stats,
								lists: data.lists,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error getting scan: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Get scan screenshot
	agent.server.tool(
		'get_url_scan_screenshot',
		'Retrieve the screenshot URL for a completed URL scan in Cloudflare. Use when the user wants to view or download the visual capture of a scanned webpage after the scan has finished processing. Do not use when you need to initiate a new scan (use start_url_scan instead). Accepts `scan_id` (required) to identify the specific completed scan. e.g., scan_id="abc123-def456-ghi789". Raises an error if the scan ID does not exist or the scan is still in progress."abc123-def456-ghi789". Returns an error if the scan is still in progress or the scan ID does not exist.',
		{
			scanId: ScanIdParam,
			resolution: z
				.enum(['desktop', 'mobile', 'tablet'])
				.default('desktop')
				.optional()
				.describe('Screenshot resolution/device type.'),
		},
		async ({ scanId, resolution }) => {
			const result = await getAccountIdOrError(agent)
			if ('error' in result) return result.error

			try {
				const props = getProps(agent)
				const res = resolution || 'desktop'

				const screenshotUrl = `${URLSCANNER_API_BASE}/${result.accountId}/urlscanner/v2/screenshots/${scanId}.png`
				// Verify the screenshot exists
				const response = await fetch(screenshotUrl, {
					method: 'HEAD',
					headers: { Authorization: `Bearer ${props.accessToken}` },
				})

				if (!response.ok) {
					throw new Error('Screenshot not available. The scan may still be in progress or failed.')
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								screenshotUrl,
								resolution: res,
								note: 'Use this URL with Authorization header to download the screenshot',
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error getting screenshot: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Get scan HAR
	agent.server.tool(
		'get_url_scan_har',
		'Retrieve the HAR (HTTP Archive) data for a completed URL scan containing detailed network request and response information. Use when the user wants to analyze network traffic, debug performance issues, or inspect HTTP headers from a website scan. Do not use when you need to initiate a new scan (use start_url_scan instead). Accepts `scan_id` (required string identifier for the completed scan), e.g., scan_id="abc123-def456-ghi789". Raises an error if the scan ID does not exist or the scan is still in progress."abc123-def456-ghi789". Returns error if the scan ID does not exist or the scan is still in progress.',
		{
			scanId: ScanIdParam,
		},
		async ({ scanId }) => {
			const result = await getAccountIdOrError(agent)
			if ('error' in result) return result.error

			try {
				const props = getProps(agent)

				const res = await fetch(
					`${URLSCANNER_API_BASE}/${result.accountId}/urlscanner/v2/har/${scanId}`,
					{
						headers: { Authorization: `Bearer ${props.accessToken}` },
					}
				)

				if (!res.ok) {
					if (res.status === 404) {
						throw new Error('HAR not available. The scan may still be in progress or failed.')
					}
					const errorData = await res.json().catch(() => ({}))
					throw new Error(`Failed to get HAR: ${res.status} ${JSON.stringify(errorData)}`)
				}

				const data = await res.json()
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(data),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error getting HAR: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
