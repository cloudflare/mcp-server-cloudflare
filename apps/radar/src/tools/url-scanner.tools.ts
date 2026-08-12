import { z } from 'zod'

import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import {
	CreateScanResult,
	ScanIdParam,
	ScanVisibilityParam,
	ScreenshotResolutionParam,
	SearchQueryParam,
	SearchSizeParam,
	UrlParam,
} from '../types/url-scanner'

import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'
import type { Env } from '../radar.context'

const URLSCANNER_API_BASE = 'https://api.cloudflare.com/client/v4/accounts'

export function registerUrlScannerTools(context: McpRegistrationContext<Env>) {
	// Search URL scans
	context.accountTool(
		'search_url_scans',
		{
			description:
				"Search URL scans using ElasticSearch-like query syntax. Examples: 'page.domain:example.com', 'verdicts.malicious:true', 'page.asn:AS24940 AND hash:xxx', 'apikey:me AND date:[2025-01 TO 2025-02]'",
			inputSchema: z.object({
				query: SearchQueryParam,
				size: SearchSizeParam,
			}),
		},
		async ({ query, size }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const url = new URL(`${URLSCANNER_API_BASE}/${accountId}/urlscanner/v2/search`)
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
					isError: true,
				}
			}
		}
	)

	// Create URL scan
	context.accountTool(
		'create_url_scan',
		{
			description:
				'Submit a URL to scan. Returns the scan UUID which can be used to retrieve results.',
			inputSchema: z.object({
				url: UrlParam,
				visibility: ScanVisibilityParam,
				screenshotResolution: ScreenshotResolutionParam,
			}),
		},
		async ({ url, visibility, screenshotResolution }, accountId) => {
			try {
				const props = requireRequestProps(context)

				const body: Record<string, unknown> = { url }
				if (visibility) body.visibility = visibility
				if (screenshotResolution) body.screenshotsResolutions = [screenshotResolution]

				const res = await fetch(`${URLSCANNER_API_BASE}/${accountId}/urlscanner/v2/scan`, {
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
					isError: true,
				}
			}
		}
	)

	// Get URL scan result
	context.accountTool(
		'get_url_scan',
		{
			description:
				'Get the results of a URL scan by its UUID. Returns detailed information including verdicts, page info, requests, cookies, and more.',
			inputSchema: z.object({
				scanId: ScanIdParam,
			}),
		},
		async ({ scanId }, accountId) => {
			try {
				const props = requireRequestProps(context)

				const res = await fetch(
					`${URLSCANNER_API_BASE}/${accountId}/urlscanner/v2/result/${scanId}`,
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
					isError: true,
				}
			}
		}
	)

	// Get scan screenshot
	context.accountTool(
		'get_url_scan_screenshot',
		{
			description: 'Get the screenshot URL for a completed scan.',
			inputSchema: z.object({
				scanId: ScanIdParam,
				resolution: z
					.enum(['desktop', 'mobile', 'tablet'])
					.default('desktop')
					.optional()
					.describe('Screenshot resolution/device type.'),
			}),
		},
		async ({ scanId, resolution }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const res = resolution || 'desktop'

				const screenshotUrl = `${URLSCANNER_API_BASE}/${accountId}/urlscanner/v2/screenshots/${scanId}.png`
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
					isError: true,
				}
			}
		}
	)

	// Get scan HAR
	context.accountTool(
		'get_url_scan_har',
		{
			description:
				'Get the HAR (HTTP Archive) data for a completed scan. Contains detailed network request/response information.',
			inputSchema: z.object({
				scanId: ScanIdParam,
			}),
		},
		async ({ scanId }, accountId) => {
			try {
				const props = requireRequestProps(context)

				const res = await fetch(`${URLSCANNER_API_BASE}/${accountId}/urlscanner/v2/har/${scanId}`, {
					headers: { Authorization: `Bearer ${props.accessToken}` },
				})

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
					isError: true,
				}
			}
		}
	)
}
