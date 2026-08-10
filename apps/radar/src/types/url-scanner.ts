/**
 * This file contains the validators for the URL scanner tools.
 */
import { z } from 'zod'

export const UrlParam = z
	.string()
	.url()
	.describe('A valid URL including protocol (e.g., "https://example.com").')

export const ScanIdParam = z.string().uuid().describe('The UUID of the scan.')

export const SearchQueryParam = z
	.string()
	.optional()
	.describe(
		"ElasticSearch-like query to filter scans. Examples: 'page.domain:example.com', 'verdicts.malicious:true', 'page.asn:AS24940', 'date:[2025-01 TO 2025-02]'"
	)

export const SearchSizeParam = z
	.number()
	.int()
	.min(1)
	.max(100)
	.default(10)
	.optional()
	.describe('Limit the number of results (1-100, default 10).')

export const ScanVisibilityParam = z
	.enum(['Public', 'Unlisted'])
	.default('Public')
	.optional()
	.describe(
		'Scan visibility. Public scans appear in search results. Unlisted scans require the scan ID to access.'
	)

export const ScreenshotResolutionParam = z
	.enum(['desktop', 'mobile', 'tablet'])
	.default('desktop')
	.optional()
	.describe('Screenshot resolution/device type.')

export const CreateScanResult = z
	.object({
		uuid: z.string(),
	})
	.passthrough()
