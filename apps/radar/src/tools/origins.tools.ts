/**
 * Cloud Observatory / Origins Tools
 *
 * These tools provide insights into hyperscaler (cloud provider) performance metrics
 * as observed from Cloudflare's network. The data powers the Cloud Observatory feature
 * in Cloudflare Radar (https://radar.cloudflare.com/cloud-observatory).
 *
 * Supported cloud providers: Amazon (AWS), Google (GCP), Microsoft (Azure), Oracle (OCI)
 */
import { getProps } from '@repo/mcp-common/src/get-props'
import {
	PaginationLimitParam,
	PaginationOffsetParam,
} from '@repo/mcp-common/src/types/shared.types'

import {
	OriginAggIntervalParam,
	OriginArrayParam,
	OriginDimensionParam,
	OriginLimitPerGroupParam,
	OriginMetricParam,
	OriginNormalizationParam,
	OriginRegionParam,
	OriginSlugParam,
} from '../types/origins'
import { DateEndArrayParam, DateRangeArrayParam, DateStartArrayParam } from '../types/radar'

import type { RadarMCP } from '../radar.app'

const RADAR_API_BASE = 'https://api.cloudflare.com/client/v4/radar'

/**
 * Helper function to make authenticated requests to the Radar Origins API
 */
async function fetchOriginsApi(
	accessToken: string,
	endpoint: string,
	params: Record<string, unknown> = {}
): Promise<unknown> {
	const url = new URL(`${RADAR_API_BASE}${endpoint}`)

	// Add query parameters, handling arrays properly
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue

		if (Array.isArray(value)) {
			for (const item of value) {
				url.searchParams.append(key, String(item))
			}
		} else {
			url.searchParams.set(key, String(value))
		}
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorBody = await response.text()
		throw new Error(`API request failed (${response.status}): ${errorBody}`)
	}

	const data = (await response.json()) as { success: boolean; result: unknown; errors?: unknown[] }

	if (!data.success) {
		throw new Error(`API returned error: ${JSON.stringify(data.errors)}`)
	}

	return data.result
}

export function registerOriginsTools(agent: RadarMCP) {
	/**
	 * List all available cloud provider origins with their regions
	 */
	agent.server.tool(
		'list_origins',
		'List cloud provider origins (hyperscalers) available in Cloud Observatory. Returns Amazon (AWS), Google (GCP), Microsoft (Azure), and Oracle (OCI) with their available regions.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
		},
		async ({ limit, offset }) => {
			try {
				const props = getProps(agent)
				const result = await fetchOriginsApi(props.accessToken, '/origins', {
					limit,
					offset,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing origins: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Get details for a specific cloud provider origin
	 */
	agent.server.tool(
		'get_origin_details',
		'Get details for a specific cloud provider origin, including all available regions.',
		{
			slug: OriginSlugParam,
		},
		async ({ slug }) => {
			try {
				const props = getProps(agent)
				const result = await fetchOriginsApi(props.accessToken, `/origins/${slug}`)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting origin details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Get time series metrics for cloud provider origins
	 */
	agent.server.tool(
		'get_origins_timeseries',
		'Retrieve time series performance metrics for cloud provider origins. Use this to analyze trends in connection performance, latency, and reliability over time.',
		{
			origin: OriginArrayParam,
			metric: OriginMetricParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			region: OriginRegionParam,
			aggInterval: OriginAggIntervalParam,
		},
		async ({ origin, metric, dateRange, dateStart, dateEnd, region, aggInterval }) => {
			try {
				const props = getProps(agent)
				const result = await fetchOriginsApi(props.accessToken, '/origins/timeseries', {
					origin,
					metric,
					dateRange,
					dateStart,
					dateEnd,
					region,
					aggInterval,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting origins timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Get summary metrics for cloud provider origins grouped by dimension
	 */
	agent.server.tool(
		'get_origins_summary',
		'Retrieve aggregated summary of cloud provider performance metrics grouped by dimension (region, success rate, or percentile). Useful for comparing performance across regions or understanding distribution.',
		{
			dimension: OriginDimensionParam,
			origin: OriginArrayParam,
			metric: OriginMetricParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			region: OriginRegionParam,
			limitPerGroup: OriginLimitPerGroupParam,
		},
		async ({ dimension, origin, metric, dateRange, dateStart, dateEnd, region, limitPerGroup }) => {
			try {
				const props = getProps(agent)
				const result = await fetchOriginsApi(props.accessToken, `/origins/summary/${dimension}`, {
					origin,
					metric,
					dateRange,
					dateStart,
					dateEnd,
					region,
					limitPerGroup,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting origins summary: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Get time series metrics for cloud provider origins grouped by dimension
	 */
	agent.server.tool(
		'get_origins_timeseries_groups',
		'Retrieve time series of cloud provider performance metrics grouped by dimension over time. Use this to visualize how metrics like latency vary across regions or percentiles over time.',
		{
			dimension: OriginDimensionParam,
			origin: OriginArrayParam,
			metric: OriginMetricParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			region: OriginRegionParam,
			aggInterval: OriginAggIntervalParam,
			limitPerGroup: OriginLimitPerGroupParam,
			normalization: OriginNormalizationParam,
		},
		async ({
			dimension,
			origin,
			metric,
			dateRange,
			dateStart,
			dateEnd,
			region,
			aggInterval,
			limitPerGroup,
			normalization,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchOriginsApi(
					props.accessToken,
					`/origins/timeseries_groups/${dimension}`,
					{
						origin,
						metric,
						dateRange,
						dateStart,
						dateEnd,
						region,
						aggInterval,
						limitPerGroup,
						normalization,
					}
				)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting origins timeseries groups: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
