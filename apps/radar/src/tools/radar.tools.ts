import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'
import {
	PaginationLimitParam,
	PaginationOffsetParam,
} from '@repo/mcp-common/src/types/shared.types'

import {
	AiDimensionParam,
	AnnotationDataSourceParam,
	AnnotationEventTypeParam,
	As112DimensionParam,
	As112ProtocolParam,
	As112QueryTypeParam,
	As112ResponseCodeParam,
	AsnArrayParam,
	AsnParam,
	AsOrderByParam,
	BgpHijackerAsnParam,
	BgpInvalidOnlyParam,
	BgpInvolvedAsnParam,
	BgpInvolvedCountryParam,
	BgpIpVersionParam,
	BgpLeakAsnParam,
	BgpLongestPrefixMatchParam,
	BgpMaxConfidenceParam,
	BgpMinConfidenceParam,
	BgpOriginParam,
	BgpPrefixArrayParam,
	BgpPrefixParam,
	BgpRpkiStatusParam,
	BgpSortByParam,
	BgpSortOrderParam,
	BgpUpdateTypeParam,
	BgpVictimAsnParam,
	BotCategoryParam,
	BotKindParam,
	BotNameParam,
	BotOperatorParam,
	BotsCrawlersDimensionParam,
	BotsCrawlersFormatParam,
	BotsDimensionParam,
	BotVerificationStatusParam,
	BucketSizeParam,
	ContinentArrayParam,
	CrawlerClientTypeParam,
	CrawlerIndustryParam,
	CrawlerVerticalParam,
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
	DomainCategoryArrayParam,
	DomainParam,
	DomainRankingTypeParam,
	DomainsArrayParam,
	EmailRoutingDimensionParam,
	EmailSecurityDimensionParam,
	GeoIdArrayParam,
	GeoIdParam,
	HttpDimensionParam,
	InternetQualityMetricParam,
	InternetServicesCategoryParam,
	InternetSpeedDimensionParam,
	InternetSpeedOrderByParam,
	IpParam,
	L3AttackDimensionParam,
	L7AttackDimensionParam,
	LeakedCredentialsBotClassParam,
	LeakedCredentialsCompromisedParam,
	LeakedCredentialsDimensionParam,
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
	RobotsTxtDimensionParam,
	RobotsTxtDirectiveParam,
	RobotsTxtDomainCategoryParam,
	RobotsTxtPatternParam,
	RobotsTxtUserAgentCategoryParam,
	SpeedHistogramMetricParam,
	TcpResetsTimeoutsDimensionParam,
	TldFilterParam,
	TldManagerParam,
	TldParam,
	TldTypeParam,
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

				const result = await fetchRadarApi(props.accessToken, `/http/${dimension}`, {
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
							text: `Error getting HTTP data: ${error instanceof Error ? error.message : String(error)}`,
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

				const result = await fetchRadarApi(props.accessToken, `/dns/${dimension}`, {
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
							text: `Error getting DNS data: ${error instanceof Error ? error.message : String(error)}`,
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

				const result = await fetchRadarApi(props.accessToken, `/ai/${dimension}`, {
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
							text: `Error getting AI data: ${error instanceof Error ? error.message : String(error)}`,
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

				const result = await fetchRadarApi(props.accessToken, `/ct/${dimension}`, {
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

	// ============================================================
	// Robots.txt Tools
	// ============================================================

	agent.server.tool(
		'get_robots_txt_data',
		'Retrieve robots.txt analysis data. Shows how websites configure crawler access rules, particularly for AI crawlers. Useful for understanding web crawler policies across domains.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			date: DateListParam.optional(),
			directive: RobotsTxtDirectiveParam,
			pattern: RobotsTxtPatternParam,
			domainCategory: RobotsTxtDomainCategoryParam,
			userAgentCategory: RobotsTxtUserAgentCategoryParam,
			dimension: RobotsTxtDimensionParam,
			limitPerGroup: LimitPerGroupParam,
			limit: PaginationLimitParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			date,
			directive,
			pattern,
			domainCategory,
			userAgentCategory,
			dimension,
			limitPerGroup,
			limit,
		}) => {
			try {
				const props = getProps(agent)

				const endpoint = `/robots_txt/${dimension}`

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					date,
					directive,
					pattern,
					domainCategory,
					userAgentCategory,
					limitPerGroup,
					limit,
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
							text: `Error getting robots.txt data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Bots Crawlers Tools
	// ============================================================

	agent.server.tool(
		'get_bots_crawlers_data',
		'Retrieve web crawler HTTP request data. Shows crawler traffic patterns by client type, user agent, referrer, and industry. Useful for analyzing crawler behavior and traffic distribution.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			dimension: BotsCrawlersDimensionParam,
			format: BotsCrawlersFormatParam,
			botOperator: BotOperatorParam,
			vertical: CrawlerVerticalParam,
			industry: CrawlerIndustryParam,
			clientType: CrawlerClientTypeParam,
			limitPerGroup: LimitPerGroupParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			dimension,
			format,
			botOperator,
			vertical,
			industry,
			clientType,
			limitPerGroup,
		}) => {
			try {
				const props = getProps(agent)

				const endpoint = `/bots/crawlers/${format}/${dimension}`

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					botOperator,
					vertical,
					industry,
					clientType,
					limitPerGroup,
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
							text: `Error getting bots crawlers data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'list_bots',
		'List known bots with their details. Includes AI crawlers, search engines, monitoring bots, and more. Filter by category, operator, kind, or verification status.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			botCategory: z
				.enum([
					'SEARCH_ENGINE_CRAWLER',
					'SEARCH_ENGINE_OPTIMIZATION',
					'MONITORING_AND_ANALYTICS',
					'ADVERTISING_AND_MARKETING',
					'SOCIAL_MEDIA_MARKETING',
					'PAGE_PREVIEW',
					'ACADEMIC_RESEARCH',
					'SECURITY',
					'ACCESSIBILITY',
					'WEBHOOKS',
					'FEED_FETCHER',
					'AI_CRAWLER',
					'AGGREGATOR',
					'AI_ASSISTANT',
					'AI_SEARCH',
					'ARCHIVER',
				])
				.optional()
				.describe('Filter by bot category.'),
			botOperator: z.string().optional().describe('Filter by bot operator name.'),
			kind: z.enum(['AGENT', 'BOT']).optional().describe('Filter by bot kind.'),
			botVerificationStatus: z
				.enum(['VERIFIED'])
				.optional()
				.describe('Filter by verification status.'),
		},
		async ({ limit, offset, botCategory, botOperator, kind, botVerificationStatus }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bots', {
					limit,
					offset,
					botCategory,
					botOperator,
					kind,
					botVerificationStatus,
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
							text: `Error listing bots: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bot_details',
		'Get detailed information about a specific bot by its slug identifier.',
		{
			botSlug: z.string().describe('The bot slug identifier (e.g., "googlebot", "bingbot").'),
		},
		async ({ botSlug }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/bots/${botSlug}`)

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
							text: `Error getting bot details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Leaked Credential Checks Tools
	// ============================================================

	agent.server.tool(
		'get_leaked_credentials_data',
		'Retrieve trends in HTTP authentication requests and compromised credential detection. Shows distribution by compromised status and bot class.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			botClass: LeakedCredentialsBotClassParam,
			compromised: LeakedCredentialsCompromisedParam,
			dimension: LeakedCredentialsDimensionParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			asn,
			continent,
			location,
			botClass,
			compromised,
			dimension,
		}) => {
			try {
				const props = getProps(agent)

				let endpoint: string
				if (dimension === 'timeseries') {
					endpoint = '/leaked_credential_checks/timeseries'
				} else {
					endpoint = `/leaked_credential_checks/${dimension}`
				}

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					asn,
					continent,
					location,
					botClass,
					compromised,
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
							text: `Error getting leaked credentials data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// AS112 Tools
	// ============================================================

	agent.server.tool(
		'get_as112_data',
		'Retrieve AS112 DNS sink hole data. AS112 handles reverse DNS lookups for private IP addresses (RFC 1918). Useful for analyzing DNS misconfiguration patterns.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			queryType: As112QueryTypeParam,
			protocol: As112ProtocolParam,
			responseCode: As112ResponseCodeParam,
			dimension: As112DimensionParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			continent,
			location,
			queryType,
			protocol,
			responseCode,
			dimension,
		}) => {
			try {
				const props = getProps(agent)

				let endpoint: string
				if (dimension === 'timeseries') {
					endpoint = '/as112/timeseries'
				} else if (dimension === 'top/locations') {
					endpoint = '/as112/top/locations'
				} else {
					endpoint = `/as112/${dimension}`
				}

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					continent,
					location,
					queryType,
					protocol,
					responseCode,
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
							text: `Error getting AS112 data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Geolocation Tools
	// ============================================================

	agent.server.tool(
		'list_geolocations',
		'List available geolocations (ADM1 - administrative divisions like states/provinces). Use this to find GeoNames IDs for filtering HTTP and NetFlows data by region.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			geoId: z.string().optional().describe('Filter by specific GeoNames ID.'),
			location: LocationParam.optional(),
		},
		async ({ limit, offset, geoId, location }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/geolocations', {
					limit,
					offset,
					geoId,
					location,
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
							text: `Error listing geolocations: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_geolocation_details',
		'Get details for a specific geolocation by its GeoNames ID.',
		{
			geoId: GeoIdParam,
		},
		async ({ geoId }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/geolocations/${geoId}`)

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
							text: `Error getting geolocation details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// TCP Resets/Timeouts Tools
	// ============================================================

	agent.server.tool(
		'get_tcp_resets_timeouts_data',
		'Retrieve TCP connection quality metrics including resets and timeouts. Useful for understanding connection reliability across networks and locations.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: TcpResetsTimeoutsDimensionParam,
		},
		async ({ dateRange, dateStart, dateEnd, asn, continent, location, dimension }) => {
			try {
				const props = getProps(agent)

				const endpoint =
					dimension === 'summary'
						? '/tcp_resets_timeouts/summary'
						: '/tcp_resets_timeouts/timeseries_groups'

				const result = await fetchRadarApi(props.accessToken, endpoint, {
					dateRange,
					dateStart,
					dateEnd,
					asn,
					continent,
					location,
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
							text: `Error getting TCP resets/timeouts data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Annotations/Outages Tools
	// ============================================================

	agent.server.tool(
		'get_annotations',
		'Retrieve annotations including Internet events, outages, and anomalies from various Cloudflare data sources.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			dataSource: AnnotationDataSourceParam,
			eventType: AnnotationEventTypeParam,
			asn: AsnParam.optional(),
			location: LocationParam.optional(),
		},
		async ({
			limit,
			offset,
			dateRange,
			dateStart,
			dateEnd,
			dataSource,
			eventType,
			asn,
			location,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/annotations', {
					limit,
					offset,
					dateRange,
					dateStart,
					dateEnd,
					dataSource,
					eventType,
					asn,
					location,
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
							text: `Error getting annotations: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_outages',
		'Retrieve Internet outages and anomalies. Provides information about detected connectivity issues across ASes and locations.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			asn: AsnParam.optional(),
			location: LocationParam.optional(),
		},
		async ({ limit, offset, dateRange, dateStart, dateEnd, asn, location }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/annotations/outages', {
					limit,
					offset,
					dateRange,
					dateStart,
					dateEnd,
					asn,
					location,
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
							text: `Error getting outages: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Certificate Transparency Authorities & Logs Tools
	// ============================================================

	agent.server.tool(
		'list_ct_authorities',
		'List Certificate Authorities (CAs) tracked in Certificate Transparency logs.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
		},
		async ({ limit, offset }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/ct/authorities', {
					limit,
					offset,
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
							text: `Error listing CT authorities: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_ct_authority_details',
		'Get details for a specific Certificate Authority by its slug.',
		{
			caSlug: z.string().describe('The Certificate Authority slug identifier.'),
		},
		async ({ caSlug }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/ct/authorities/${caSlug}`)

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
							text: `Error getting CT authority details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'list_ct_logs',
		'List Certificate Transparency logs.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
		},
		async ({ limit, offset }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/ct/logs', {
					limit,
					offset,
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
							text: `Error listing CT logs: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_ct_log_details',
		'Get details for a specific Certificate Transparency log by its slug.',
		{
			logSlug: z.string().describe('The Certificate Transparency log slug identifier.'),
		},
		async ({ logSlug }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/ct/logs/${logSlug}`)

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
							text: `Error getting CT log details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// BGP Additional Tools
	// ============================================================

	agent.server.tool(
		'get_bgp_timeseries',
		'Retrieve BGP updates time series data. Shows BGP announcement and withdrawal patterns over time.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			prefix: BgpPrefixArrayParam,
			updateType: BgpUpdateTypeParam,
		},
		async ({ dateRange, dateStart, dateEnd, asn, prefix, updateType }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/timeseries', {
					dateRange,
					dateStart,
					dateEnd,
					asn,
					prefix,
					updateType,
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
							text: `Error getting BGP timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_top_ases',
		'Get top Autonomous Systems by BGP update count.',
		{
			limit: PaginationLimitParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			prefix: BgpPrefixArrayParam,
			updateType: BgpUpdateTypeParam,
		},
		async ({ limit, dateRange, dateStart, dateEnd, asn, prefix, updateType }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/top/ases', {
					limit,
					dateRange,
					dateStart,
					dateEnd,
					asn,
					prefix,
					updateType,
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
							text: `Error getting BGP top ASes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_top_prefixes',
		'Get top IP prefixes by BGP update count.',
		{
			limit: PaginationLimitParam,
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			updateType: BgpUpdateTypeParam,
		},
		async ({ limit, dateRange, dateStart, dateEnd, asn, updateType }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/top/prefixes', {
					limit,
					dateRange,
					dateStart,
					dateEnd,
					asn,
					updateType,
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
							text: `Error getting BGP top prefixes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_moas',
		'Get Multi-Origin AS (MOAS) prefixes. MOAS occurs when a prefix is announced by multiple ASes, which can indicate hijacking or legitimate anycast.',
		{
			origin: BgpOriginParam,
			prefix: BgpPrefixParam,
			invalidOnly: BgpInvalidOnlyParam,
		},
		async ({ origin, prefix, invalidOnly }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/routes/moas', {
					origin,
					prefix,
					invalid_only: invalidOnly,
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
							text: `Error getting BGP MOAS: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_pfx2as',
		'Get prefix-to-ASN mapping. Useful for looking up which AS announces a given IP prefix.',
		{
			prefix: BgpPrefixParam,
			origin: BgpOriginParam,
			rpkiStatus: BgpRpkiStatusParam,
			longestPrefixMatch: BgpLongestPrefixMatchParam,
		},
		async ({ prefix, origin, rpkiStatus, longestPrefixMatch }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/routes/pfx2as', {
					prefix,
					origin,
					rpkiStatus,
					longestPrefixMatch,
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
							text: `Error getting BGP pfx2as: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_ip_space_timeseries',
		'Retrieve announced IP address space time series data. Shows the count of announced IPv4 /24s and IPv6 /48s over time. Essential for monitoring BGP route withdrawals, IPv6 address space changes, and detecting significant routing events by ASN or country.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			location: LocationArrayParam,
			ipVersion: BgpIpVersionParam,
		},
		async ({ dateRange, dateStart, dateEnd, asn, location, ipVersion }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/ips/timeseries', {
					dateRange,
					dateStart,
					dateEnd,
					asn,
					location,
					ipVersion,
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
							text: `Error getting BGP IP space timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_routes_realtime',
		'Get real-time BGP routes for a specific IP prefix using public route collectors (RouteViews and RIPE RIS). Shows current routing state including AS paths, RPKI validation status, and visibility across peers. Useful for troubleshooting routing issues and verifying route announcements.',
		{
			prefix: BgpPrefixParam,
		},
		async ({ prefix }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/routes/realtime', {
					prefix,
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
							text: `Error getting real-time BGP routes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// AS Sets and Relationships Tools
	// ============================================================

	agent.server.tool(
		'get_as_set',
		'Get IRR AS-SETs that an Autonomous System is a member of. AS-SETs are used in routing policies.',
		{
			asn: AsnParam,
		},
		async ({ asn }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/entities/asns/${asn}/as_set`)

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
							text: `Error getting AS set: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_as_relationships',
		'Get AS-level relationships for an Autonomous System. Shows peer, upstream, and downstream relationships with other ASes.',
		{
			asn: AsnParam,
			asn2: z
				.number()
				.int()
				.positive()
				.optional()
				.describe('Optional second ASN to check specific relationship.'),
		},
		async ({ asn, asn2 }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/entities/asns/${asn}/rel`, {
					asn2,
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
							text: `Error getting AS relationships: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// TLD Tools
	// ============================================================

	agent.server.tool(
		'list_tlds',
		'List top-level domains (TLDs) including generic, country-code, and sponsored TLDs. Filter by type or manager.',
		{
			limit: PaginationLimitParam,
			offset: PaginationOffsetParam,
			tldType: TldTypeParam,
			manager: TldManagerParam,
			tld: TldFilterParam,
		},
		async ({ limit, offset, tldType, manager, tld }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/entities/tlds', {
					limit,
					offset,
					tldType,
					manager,
					tld,
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
							text: `Error listing TLDs: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_tld_details',
		'Get detailed information about a specific top-level domain (TLD).',
		{
			tld: TldParam,
		},
		async ({ tld }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/entities/tlds/${tld}`)

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
							text: `Error getting TLD details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Ranking Timeseries Tool
	// ============================================================

	agent.server.tool(
		'get_domains_ranking_timeseries',
		'Get domain ranking timeseries data. Track how specific domains rank over time.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			domains: DomainsArrayParam,
			domainCategory: DomainCategoryArrayParam,
			location: LocationArrayParam,
			limit: PaginationLimitParam,
		},
		async ({ dateRange, dateStart, dateEnd, domains, domainCategory, location, limit }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/ranking/timeseries_groups', {
					dateRange,
					dateStart,
					dateEnd,
					domains,
					domainCategory,
					location,
					limit,
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
							text: `Error getting domains ranking timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Speed Histogram Tool
	// ============================================================

	agent.server.tool(
		'get_speed_histogram',
		'Get speed test histogram data. Shows distribution of speed test results for bandwidth, latency, or jitter.',
		{
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			metric: SpeedHistogramMetricParam,
			bucketSize: BucketSizeParam,
		},
		async ({ dateEnd, asn, continent, location, metric, bucketSize }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/quality/speed/histogram', {
					dateEnd,
					asn,
					continent,
					location,
					metric,
					bucketSize,
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
							text: `Error getting speed histogram: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
