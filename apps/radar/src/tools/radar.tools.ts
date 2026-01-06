import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'
import {
	PaginationLimitParam,
	PaginationOffsetParam,
} from '@repo/mcp-common/src/types/shared.types'

import {
	AiDimensionParam,
	AsnArrayParam,
	AsnParam,
	AsOrderByParam,
	BgpHijackerAsnParam,
	BgpInvolvedAsnParam,
	BgpInvolvedCountryParam,
	BgpLeakAsnParam,
	BgpMaxConfidenceParam,
	BgpMinConfidenceParam,
	BgpPrefixParam,
	BgpSortByParam,
	BgpSortOrderParam,
	BgpVictimAsnParam,
	BotCategoryParam,
	BotKindParam,
	BotNameParam,
	BotOperatorParam,
	BotsDimensionParam,
	BotVerificationStatusParam,
	ContinentArrayParam,
	CtCaOwnerParam,
	CtCaParam,
	CtDimensionParam,
	CtDurationParam,
	CtEntryTypeParam,
	CtPublicKeyAlgorithmParam,
	CtTldParam,
	CtValidationLevelParam,
	DateEndArrayParam,
	DateEndParam,
	DateListParam,
	DateRangeArrayParam,
	DateRangeParam,
	DateStartArrayParam,
	DateStartParam,
	DnsDimensionParam,
	DomainParam,
	DomainRankingTypeParam,
	EmailRoutingDimensionParam,
	EmailSecurityDimensionParam,
	GeoIdArrayParam,
	HttpDimensionParam,
	InternetQualityMetricParam,
	InternetServicesCategoryParam,
	InternetSpeedDimensionParam,
	InternetSpeedOrderByParam,
	IpParam,
	L3AttackDimensionParam,
	L7AttackDimensionParam,
	LimitPerGroupParam,
	LocationArrayParam,
	LocationListParam,
	LocationParam,
	NetflowsDimensionParam,
	NetflowsProductParam,
	NormalizationParam,
	OriginArrayParam,
	OriginDataDimensionParam,
	OriginMetricParam,
	OriginNormalizationParam,
	OriginRegionParam,
	OriginSlugParam,
} from '../types/radar'
import { resolveAndInvoke } from '../utils'

import type { RadarMCP } from '../radar.app'

const RADAR_API_BASE = 'https://api.cloudflare.com/client/v4/radar'

/**
 * Helper function to make authenticated requests to the Radar API
 * Used for endpoints not yet available in the Cloudflare SDK
 */
async function fetchRadarApi(
	accessToken: string,
	endpoint: string,
	params: Record<string, unknown> = {}
): Promise<unknown> {
	const url = new URL(`${RADAR_API_BASE}${endpoint}`)

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

export function registerRadarTools(agent: RadarMCP) {
	agent.server.tool(
		'list_autonomous_systems',
		'List Autonomous Systems',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			location: LocationParam.optional(),
			orderBy: AsOrderByParam,
		},
		async ({ limit, offset, location, orderBy }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.entities.asns.list({
					limit,
					offset,
					location,
					orderBy,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.asns,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing ASes: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_as_details',
		'Get Autonomous System details by ASN',
		{
			asn: AsnParam,
		},
		async ({ asn }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.entities.asns.get(asn)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.asn,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting AS details: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_ip_details',
		'Get IP address information',
		{
			ip: IpParam,
		},
		async ({ ip }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.entities.get({ ip })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.ip,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting IP details: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_traffic_anomalies',
		'Get traffic anomalies and outages',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			asn: AsnParam.optional(),
			location: LocationParam.optional(),
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
		},
		async ({ limit, offset, asn, location, dateStart, dateEnd, dateRange }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.trafficAnomalies.get({
					limit,
					offset,
					asn,
					location,
					dateRange,
					dateStart,
					dateEnd,
					status: 'VERIFIED',
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.trafficAnomalies,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting IP details: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_internet_services_ranking',
		'Get top Internet services',
		{
			limit: PaginationLimitParam,
			date: DateListParam.optional(),
			serviceCategory: InternetServicesCategoryParam.optional(),
		},
		async ({ limit, date, serviceCategory }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.ranking.internetServices.top({
					limit,
					date,
					serviceCategory,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Internet services ranking: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_domains_ranking',
		'Get top or trending domains',
		{
			limit: PaginationLimitParam,
			date: DateListParam.optional(),
			location: LocationListParam.optional(),
			rankingType: DomainRankingTypeParam.optional(),
		},
		async ({ limit, date, location, rankingType }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.ranking.top({
					limit,
					date,
					location,
					rankingType,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting domains ranking: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_domain_rank_details',
		'Get domain rank details',
		{
			domain: DomainParam,
			date: DateListParam.optional(),
		},
		async ({ domain, date }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.ranking.domain.get(domain, { date })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting domain ranking details: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_http_data',
		'Retrieve HTTP traffic trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			geoId: GeoIdArrayParam,
			dimension: HttpDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, geoId, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.http, dimension, {
					asn,
					continent,
					location,
					geoId,
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting HTTP data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_dns_queries_data',
		'Retrieve trends in DNS queries to the 1.1.1.1 resolver.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: DnsDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.dns, dimension, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting DNS data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_l7_attack_data',
		'Retrieve application layer (L7) attack trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: L7AttackDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.attacks.layer7, dimension, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting L7 attack data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_l3_attack_data',
		'Retrieve application layer (L3) attack trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: L3AttackDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.attacks.layer3, dimension, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting L3 attack data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_email_routing_data',
		'Retrieve Email Routing trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			dimension: EmailRoutingDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.email.routing, dimension, {
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Email Routing data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_email_security_data',
		'Retrieve Email Security trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			dimension: EmailSecurityDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.email.security, dimension, {
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Email Security data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_internet_speed_data',
		'Retrieve summary of bandwidth, latency, jitter, and packet loss, from the previous 90 days of Cloudflare Speed Test.',
		{
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: InternetSpeedDimensionParam,
			orderBy: InternetSpeedOrderByParam.optional(),
		},
		async ({ dateEnd, asn, location, continent, dimension, orderBy }) => {
			if (orderBy && dimension === 'summary') {
				throw new Error('Order by is only allowed for top locations and ASes')
			}

			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.quality.speed, dimension, {
					asn,
					continent,
					location,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Internet speed data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_internet_quality_data',
		'Retrieves a summary or time series of bandwidth, latency, or DNS response time percentiles from the Radar Internet Quality Index (IQI).',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			format: z.enum(['summary', 'timeseriesGroups']),
			metric: InternetQualityMetricParam,
		},
		async ({ dateRange, dateStart, dateEnd, asn, location, continent, format, metric }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.quality.iqi[format]({
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
					metric,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting Internet quality data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_ai_data',
		'Retrieves AI-related data, including traffic from AI user agents, as well as popular models and model tasks specifically from Cloudflare Workers AI.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: AiDimensionParam,
		},
		async ({ dateRange, dateStart, dateEnd, asn, location, continent, dimension }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await resolveAndInvoke(client.radar.ai, dimension, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting AI data: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// BGP Tools
	// TODO: Replace with SDK when BGP hijacks/leaks endpoints work correctly in cloudflare SDK
	// ============================================================

	agent.server.tool(
		'get_bgp_hijacks',
		'Retrieve BGP hijack events. BGP hijacks occur when an AS announces routes it does not own, potentially redirecting traffic.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			hijackerAsn: BgpHijackerAsnParam,
			victimAsn: BgpVictimAsnParam,
			involvedAsn: BgpInvolvedAsnParam,
			involvedCountry: BgpInvolvedCountryParam,
			prefix: BgpPrefixParam,
			minConfidence: BgpMinConfidenceParam,
			maxConfidence: BgpMaxConfidenceParam,
			sortBy: BgpSortByParam,
			sortOrder: BgpSortOrderParam,
		},
		async ({
			limit,
			offset,
			dateRange,
			dateStart,
			dateEnd,
			hijackerAsn,
			victimAsn,
			involvedAsn,
			involvedCountry,
			prefix,
			minConfidence,
			maxConfidence,
			sortBy,
			sortOrder,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/hijacks/events', {
					page: offset ? Math.floor(offset / (limit || 10)) + 1 : 1,
					per_page: limit,
					dateRange,
					dateStart,
					dateEnd,
					hijackerAsn,
					victimAsn,
					involvedAsn,
					involvedCountry,
					prefix,
					minConfidence,
					maxConfidence,
					sortBy,
					sortOrder,
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
							text: `Error getting BGP hijacks: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_leaks',
		'Retrieve BGP route leak events. Route leaks occur when an AS improperly announces routes learned from one peer to another.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			leakAsn: BgpLeakAsnParam,
			involvedAsn: BgpInvolvedAsnParam,
			involvedCountry: BgpInvolvedCountryParam,
			sortBy: BgpSortByParam,
			sortOrder: BgpSortOrderParam,
		},
		async ({
			limit,
			offset,
			dateRange,
			dateStart,
			dateEnd,
			leakAsn,
			involvedAsn,
			involvedCountry,
			sortBy,
			sortOrder,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/leaks/events', {
					page: offset ? Math.floor(offset / (limit || 10)) + 1 : 1,
					per_page: limit,
					dateRange,
					dateStart,
					dateEnd,
					leakAsn,
					involvedAsn,
					involvedCountry,
					sortBy,
					sortOrder,
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
							text: `Error getting BGP leaks: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_route_stats',
		'Retrieve BGP routing table statistics including number of routes, origin ASes, and more.',
		{
			asn: AsnParam.optional(),
			location: LocationParam.optional(),
		},
		async ({ asn, location }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.radar.bgp.routes.stats({
					asn,
					location,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting BGP route stats: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Bots Tools
	// TODO: Replace with SDK when bots endpoints are added to cloudflare SDK
	// ============================================================

	agent.server.tool(
		'get_bots_data',
		'Retrieve bot traffic data including trends by bot name, operator, category, and kind. Covers AI crawlers, search engines, monitoring bots, and more.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			bot: BotNameParam,
			botOperator: BotOperatorParam,
			botCategory: BotCategoryParam,
			botKind: BotKindParam,
			botVerificationStatus: BotVerificationStatusParam,
			dimension: BotsDimensionParam,
			limitPerGroup: LimitPerGroupParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			asn,
			continent,
			location,
			bot,
			botOperator,
			botCategory,
			botKind,
			botVerificationStatus,
			dimension,
			limitPerGroup,
		}) => {
			try {
				const props = getProps(agent)

				const endpoint = dimension === 'timeseries' ? '/bots/timeseries' : `/bots/${dimension}`

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
					bot,
					botOperator,
					botCategory,
					botKind,
					botVerificationStatus,
					limitPerGroup: dimension !== 'timeseries' ? limitPerGroup : undefined,
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
							text: `Error getting bots data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Certificate Transparency Tools
	// TODO: Replace with SDK when CT endpoints are added to cloudflare SDK
	// ============================================================

	agent.server.tool(
		'get_certificate_transparency_data',
		'Retrieve Certificate Transparency (CT) log data. CT provides visibility into SSL/TLS certificates issued for domains, useful for security monitoring.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			ca: CtCaParam,
			caOwner: CtCaOwnerParam,
			duration: CtDurationParam,
			entryType: CtEntryTypeParam,
			tld: CtTldParam,
			validationLevel: CtValidationLevelParam,
			publicKeyAlgorithm: CtPublicKeyAlgorithmParam,
			dimension: CtDimensionParam,
			limitPerGroup: LimitPerGroupParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			ca,
			caOwner,
			duration,
			entryType,
			tld,
			validationLevel,
			publicKeyAlgorithm,
			dimension,
			limitPerGroup,
		}) => {
			try {
				const props = getProps(agent)

				const endpoint = dimension === 'timeseries' ? '/ct/timeseries' : `/ct/${dimension}`

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					ca,
					caOwner,
					duration,
					entryType,
					tld,
					validationLevel,
					publicKeyAlgorithm,
					limitPerGroup: dimension !== 'timeseries' ? limitPerGroup : undefined,
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
							text: `Error getting CT data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// NetFlows Tools
	// TODO: Replace with SDK when netflows endpoints support geoId in cloudflare SDK
	// ============================================================

	agent.server.tool(
		'get_netflows_data',
		'Retrieve NetFlows traffic data showing network traffic patterns. Supports filtering by ADM1 (administrative level 1, e.g., states/provinces) via geoId.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			geoId: GeoIdArrayParam,
			product: NetflowsProductParam,
			normalization: NormalizationParam,
			dimension: NetflowsDimensionParam,
			limitPerGroup: LimitPerGroupParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			asn,
			continent,
			location,
			geoId,
			product,
			normalization,
			dimension,
			limitPerGroup,
		}) => {
			try {
				const props = getProps(agent)

				let endpoint: string
				if (dimension === 'timeseries') {
					endpoint = '/netflows/timeseries'
				} else if (dimension === 'summary') {
					endpoint = '/netflows/summary'
				} else {
					endpoint = `/netflows/${dimension}`
				}

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					asn,
					continent,
					location,
					geoId,
					dateRange,
					dateStart,
					dateEnd,
					product,
					normalization,
					limitPerGroup: !['timeseries', 'summary'].includes(dimension) ? limitPerGroup : undefined,
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
							text: `Error getting NetFlows data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Cloud Observatory / Origins Tools
	// TODO: Replace with SDK when origins endpoints are added to cloudflare SDK
	// ============================================================

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
				const result = await fetchRadarApi(props.accessToken, '/origins', {
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

	agent.server.tool(
		'get_origin_details',
		'Get details for a specific cloud provider origin, including all available regions.',
		{
			slug: OriginSlugParam,
		},
		async ({ slug }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/origins/${slug}`)

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

	agent.server.tool(
		'get_origins_data',
		'Retrieve cloud provider (AWS, GCP, Azure, OCI) performance metrics. Supports timeseries, summaries grouped by region/success_rate/percentile, and grouped timeseries.',
		{
			dimension: OriginDataDimensionParam,
			origin: OriginArrayParam,
			metric: OriginMetricParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			region: OriginRegionParam,
			limitPerGroup: LimitPerGroupParam,
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
			limitPerGroup,
			normalization,
		}) => {
			try {
				const props = getProps(agent)

				let endpoint: string
				if (dimension === 'timeseries') {
					endpoint = '/origins/timeseries'
				} else if (dimension.startsWith('summary/')) {
					const groupBy = dimension.replace('summary/', '')
					endpoint = `/origins/summary/${groupBy}`
				} else {
					const groupBy = dimension.replace('timeseriesGroups/', '')
					endpoint = `/origins/timeseries_groups/${groupBy}`
				}

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					origin,
					metric,
					dateRange,
					dateStart,
					dateEnd,
					region,
					limitPerGroup: dimension !== 'timeseries' ? limitPerGroup : undefined,
					normalization: dimension.startsWith('timeseriesGroups/') ? normalization : undefined,
				})

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Error getting origins data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
