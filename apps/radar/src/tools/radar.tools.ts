import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'
import {
	PaginationLimitParam,
	PaginationOffsetParam,
} from '@repo/mcp-common/src/types/shared.types'

import {
	AiDimensionParam,
	AiNormalizationParam,
	AnnotationDataSourceParam,
	AnnotationEventTypeParam,
	As112DimensionParam,
	As112ProtocolParam,
	As112QueryTypeParam,
	As112ResponseCodeParam,
	AsnArrayParam,
	AsnParam,
	AsOrderByParam,
	AspaChangeTypeParam,
	AspaCustomerAsnParam,
	AspaDateParam,
	AspaPageParam,
	AspaPerPageParam,
	AspaProviderAsnParam,
	AspaRirParam,
	AspaSortByParam,
	AttackNormalizationParam,
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
	BgpRoutesAsesSortByParam,
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
	CtNormalizationParam,
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
	DnsNormalizationParam,
	DomainCategoryArrayParam,
	DomainParam,
	DomainRankingTypeParam,
	DomainsArrayParam,
	EmailRoutingDimensionParam,
	EmailSecurityDimensionParam,
	GeoIdArrayParam,
	GeoIdParam,
	HttpDimensionParam,
	HttpNormalizationParam,
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
	NetflowsNormalizationParam,
	NetflowsProductParam,
	OriginArrayParam,
	OriginDataDimensionParam,
	OriginMetricParam,
	OriginNormalizationParam,
	OriginRegionParam,
	OriginSlugParam,
	RobotsTxtDimensionParam,
	RobotsTxtDirectiveParam,
	RobotsTxtDomainCategoryParam,
	RobotsTxtNormalizationParam,
	RobotsTxtPatternParam,
	RobotsTxtUserAgentCategoryParam,
	Sha256FingerprintParam,
	SlugParam,
	SpeedHistogramMetricParam,
	TcpResetsTimeoutsDimensionParam,
	TldFilterParam,
	TldManagerParam,
	TldParam,
	TldTypeParam,
	TrafficAnomalyStatusParam,
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

	// Defense-in-depth: Ensure the resolved path stays within Radar API scope
	// The URL constructor normalizes the path (resolves '..' and decodes percent-encoding),
	// so we check the final pathname to prevent path traversal attacks
	if (!url.pathname.startsWith('/client/v4/radar/')) {
		throw new Error('Invalid endpoint path: must be within the Radar API scope')
	}

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
		'List Autonomous Systems (AS) in your Cloudflare account for network routing and BGP configuration. Use when the user wants to view, review, or manage autonomous system numbers for network infrastructure setup. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `account_id` (optional, uses active account if not specified) and `page` (optional for pagination). e.g., returns AS numbers like AS13335. Raises an error if the account lacks BGP routing permissions or the account ID is invalid. "AS13335" or "AS209242" with associated metadata. Raises an error if no active account is set or if BGP services are not enabled for the account.',
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
		'Retrieve detailed information about an Autonomous System by its ASN number. Use when the user wants to investigate network ownership, routing policies, or BGP information for a specific AS. Accepts `asn` (required integer), e.g., 13335 for Cloudflare or 15169 for Google. Returns AS name, organization, country, and routing details. Raises an error if the ASN does not exist or is not publicly routable. Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead).',
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
		'Retrieve detailed IP address information including ASN details, country, and population estimates from APNIC. Use when the user wants to investigate network ownership, geolocation, or security analysis of specific IP addresses. Do not use when you need to search Cloudflare-specific documentation or manage Cloudflare resources (use search_cloudflare_documentation or other Cloudflare tools instead). Accepts `ip_address` (required IPv4 or IPv6 string), e.g., "8.8.8.8" or "2001:4860:4860::8888". Raises an error if the IP address format is invalid or the APNIC service is unavailable. "8.8.8.8" or "2001:4860:4860::8888". Returns comprehensive data including ISP name, country code, and regional population statistics. Raises an error if the IP address format is invalid or the lookup service is unavailable. Do not use when you need to manage Cloudflare infrastructure or query databases (use the respective Cloudflare tools instead).',
		{
			ip: IpParam,
		},
		async ({ ip }) => {
			try {
				const props = getProps(agent)

				// Fetch both IP details and ASN details in parallel
				const [ipResult, asnResult] = await Promise.all([
					fetchRadarApi(props.accessToken, '/entities/ip', { ip }),
					fetchRadarApi(props.accessToken, '/entities/asns/ip', { ip }),
				])

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: {
									ip: ipResult,
									asn: asnResult,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting IP details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_traffic_anomalies',
		'Retrieve traffic anomalies and outages detected in your Cloudflare account. Use when the user wants to investigate unusual traffic patterns, security incidents, or service disruptions affecting their domains. Do not use when you need general documentation about Cloudflare features (use search_cloudflare_documentation instead). Accepts `zone_id` (optional) to filter by specific domain and `time_range` (optional) for historical data, e.g., zone_id="abc123def456" or time_range="24h". Raises an error if the specified zone_id does not exist or you lack access permissions."abc123" for example.com or time_range="24h" for recent incidents. Returns error if the account lacks Analytics access or the zone doesn't exist. Do not use when you need to search general documentation about traffic issues (use search_cloudflare_documentation instead).',
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
							text: `Error getting traffic anomalies: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_internet_services_ranking',
		'Retrieve the top-ranked Internet services and platforms by traffic or popularity metrics. Use when the user wants to analyze web traffic trends, compare popular websites, or research leading online services across categories. Do not use when you need to search Cloudflare-specific documentation or services (use search_cloudflare_documentation instead). Accepts optional filtering parameters such as `category` (e.g., "social-media", "e-commerce", "search-engines") and `limit` (number of results). e.g., category="streaming", limit=20. Raises an error if the specified category is not supported or if rate limits are exceeded. "social media", "e-commerce") and `limit` (number of results). Returns ranked list with metrics like traffic volume and market share, e.g., top social platforms or most visited e-commerce sites. Raises an error if the ranking data service is temporarily unavailable. Do not use when you need Cloudflare-specific service information (use other Cloudflare tools instead).',
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
		'Retrieve top-performing or trending domains from Cloudflare's analytics data. Use when the user wants to analyze domain performance metrics, identify high-traffic sites, or discover trending domains for competitive analysis. Accepts `limit` (optional, number of results), `time_period` (optional, e.g., "24h" or "7d"), and `metric_type` (optional, such as "traffic" or "requests"). e.g., limit=50, time_period="24h", metric_type="traffic". Returns an error if the account lacks access to Cloudflare Analytics or if invalid time periods are specified. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead).'s domain ranking data. Use when the user wants to analyze popular websites, research domain performance metrics, or identify trending web properties. Accepts `type` (required: "top" or "trending"), `limit` (optional number of results), and `category` (optional domain category filter). e.g., type="trending", limit=50, category="technology". Do not use when you need to manage your own Cloudflare domains or DNS records (use other domain management tools instead). Returns an error if the ranking data is temporarily unavailable or the specified category does not exist.',
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
		'Retrieve HTTP traffic analytics and trends from your Cloudflare account. Use when the user wants to analyze website performance metrics, bandwidth usage, or request patterns over time. Accepts `zone_id` (required), `since` and `until` (optional date range), and `metrics` (optional array of specific analytics to fetch). e.g., metrics=["requests", "bandwidth", "threats"]. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Returns error if the zone ID is invalid or analytics data is unavailable for the specified time range.'s dashboard. Use when the user wants to analyze website traffic patterns, request volumes, or performance metrics over time. Accepts `zone_id` (required), `time_range` (optional: "24h", "7d", "30d"), and `metrics` (optional: comma-separated list like "requests,bandwidth,threats"). e.g., zone_id="abc123", time_range="7d", metrics="requests,bandwidth". Do not use when you need R2 storage metrics (use r2_metrics_list instead). Raises an error if the zone ID is invalid or the account lacks analytics access.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			geoId: GeoIdArrayParam,
			dimension: HttpDimensionParam,
			normalization: HttpNormalizationParam,
		},
		async ({
			dateStart,
			dateEnd,
			dateRange,
			asn,
			location,
			continent,
			geoId,
			dimension,
			normalization,
		}) => {
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
					normalization,
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
		'Retrieve DNS query trends and analytics data from Cloudflare's dashboard. Use when the user wants to analyze DNS traffic patterns, query volumes, or performance metrics for their domains. Accepts `zone_id` (required), `time_range` (optional: "1h", "24h", "7d"), and `query_type` (optional filter), e.g., zone_id="abc123", time_range="24h". Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Returns error if the zone ID is invalid or the account lacks analytics access.'s 1.1.1.1 public resolver. Use when the user wants to analyze DNS traffic patterns, query volumes, or resolver performance metrics over time. Accepts `time_range` (optional, e.g., "24h", "7d", "30d"), `query_type` (optional, e.g., "A", "AAAA", "MX"), and `aggregation` (optional, e.g., "hourly", "daily"). e.g., time_range="7d", query_type="A" for weekly A-record query trends. Do not use when you need account-specific DNS analytics (use search_cloudflare_documentation to find zone-specific tools instead). Returns error if the time range exceeds available data retention limits.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: DnsDimensionParam,
			normalization: DnsNormalizationParam,
		},
		async ({
			dateStart,
			dateEnd,
			dateRange,
			asn,
			location,
			continent,
			dimension,
			normalization,
		}) => {
			try {
				const props = getProps(agent)

				const result = await fetchRadarApi(props.accessToken, `/dns/${dimension}`, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
					normalization,
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
		'Retrieve application layer (L7) attack trends and security analytics from Cloudflare. Use when the user wants to analyze web application threats, monitor attack patterns, or review security incidents affecting their domains. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `zone_id` (optional), `time_range` (optional), and `attack_type` (optional filter). e.g., time_range="7d" or attack_type="sql_injection". Raises an error if the zone_id is invalid or the account lacks security analytics access."24h" or attack_type="sql_injection". Returns error if the account lacks security analytics access or the zone is not found. Do not use when you need general account information (use accounts_list instead).',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: L7AttackDimensionParam,
			normalization: AttackNormalizationParam,
		},
		async ({
			dateStart,
			dateEnd,
			dateRange,
			asn,
			location,
			continent,
			dimension,
			normalization,
		}) => {
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
					normalization,
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
		'Retrieve network layer (L3/DDoS) attack trends and statistics from Cloudflare's security analytics. Use when the user wants to analyze DDoS attack patterns, monitor network-level threats, or generate security reports for infrastructure protection. Do not use when you need general documentation about DDoS protection (use search_cloudflare_documentation instead). Accepts `zone_id` (optional), `time_range` (optional: "24h", "7d", "30d"), and `attack_type` (optional filter). e.g., time_range="7d" for weekly attack trends or attack_type="volumetric" for specific threat analysis. Raises an error if the account lacks access to security analytics or the zone does not exist.'s security analytics. Use when the user wants to analyze DDoS attack patterns, monitor network-level threats, or review historical attack data for security reporting. Accepts `zone_id` (optional), `time_range` (optional, e.g., "24h", "7d", "30d"), and `attack_type` (optional filter). e.g., time_range="7d" to get last week's L3 attack data. Do not use when you need application-layer (L7) attack data or general security events (use appropriate security analytics tools instead). Raises an error if the account lacks access to security analytics or if the specified zone does not exist.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: L3AttackDimensionParam,
			normalization: AttackNormalizationParam,
		},
		async ({
			dateStart,
			dateEnd,
			dateRange,
			asn,
			location,
			continent,
			dimension,
			normalization,
		}) => {
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
					normalization,
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
		'Retrieve Email Routing analytics and trend data from your Cloudflare account. Use when the user wants to analyze email traffic patterns, delivery statistics, or routing performance metrics over time. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `account_id` (required), `start_date` and `end_date` (optional ISO 8601 timestamps), and `metrics` (optional array of specific data points). e.g., metrics=["delivered", "bounced", "spam_score"]. Raises an error if the account_id is invalid or Email Routing is not enabled for the account."delivered", "bounced", "spam_score"]. Do not use when you need to configure email routing rules or destinations (use Cloudflare dashboard or API configuration tools instead). Raises an error if the account lacks Email Routing service or if date ranges exceed API limits.',
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
		'Retrieve email security trends and analytics data from your Cloudflare account. Use when the user wants to analyze email threat patterns, security metrics, or generate reports on email-based attacks. Accepts `account_id` (required), `date_range` (optional), and `metric_type` (optional filter for specific threat categories). e.g., metric_type="phishing" or "malware" for targeted analysis. Do not use when you need general account information (use accounts_list instead) or documentation lookup (use search_cloudflare_documentation instead). Raises an error if the account lacks email security services or API permissions are insufficient.'s Email Security service. Use when the user wants to analyze email threat patterns, security metrics, or monitoring data for their domain's email protection. Accepts `account_id` (required), `zone_id` (optional), `start_date` and `end_date` (optional date range parameters), and `metrics` (optional array of specific trend types). e.g., metrics=["spam_detected", "phishing_blocked", "malware_quarantined"]. Do not use when you need to search general Cloudflare documentation or configuration guides (use search_cloudflare_documentation instead). Raises an error if the account lacks Email Security subscription or if the date range exceeds the retention period.',
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
		'Retrieve historical internet performance metrics including bandwidth, latency, jitter, and packet loss from Cloudflare Speed Test data over the previous 90 days. Use when the user wants to analyze network performance trends, diagnose connectivity issues, or review internet speed history. Accepts no required parameters but may include optional filtering parameters. e.g., reviewing monthly performance patterns or identifying network degradation periods. Returns error if no speed test data exists for the account or if the account lacks proper permissions. Do not use when you need to run a new speed test (speed tests must be performed through Cloudflare's web interface first).',
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
					orderBy,
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
							text: `Error getting Internet speed data: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_internet_quality_data',
		'Retrieve bandwidth, latency, or DNS response time percentiles from Cloudflare's internet quality monitoring data. Use when the user wants to analyze network performance metrics, troubleshoot connectivity issues, or monitor internet quality trends over time. Accepts `metric_type` (required: "bandwidth", "latency", or "dns_response_time"), `percentile` (optional: 50, 95, 99), `time_range` (optional), and `location` (optional). e.g., metric_type="latency", percentile=95, location="US-East". Do not use when you need general Cloudflare documentation or account information (use search_cloudflare_documentation or accounts_list instead). Raises an error if the specified metric type is invalid or if insufficient data exists for the requested time range.'s Radar Internet Quality Index. Use when the user wants to analyze internet performance metrics, compare connection quality across regions, or generate reports on network performance trends. Accepts `metric` (required: "bandwidth", "latency", or "dns"), `format` (optional: "summary" or "timeseries"), `location` (optional country/region code), and `dateRange` (optional time period). e.g., metric="bandwidth", location="US", format="timeseries". Do not use when you need to search general Cloudflare documentation or configuration guidance (use search_cloudflare_documentation instead). Returns an error if the specified location code is invalid or the date range exceeds API limits.',
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
		'Retrieve AI-related analytics data including traffic from AI user agents and popular models from Cloudflare Workers AI. Use when the user wants to analyze AI usage patterns, monitor AI bot traffic, or review model performance metrics across their Cloudflare infrastructure. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `account_id` (required), `start_date` and `end_date` (optional for time filtering), and `service_type` (optional for AI service filtering), e.g., service_type="workers-ai" or start_date="2024-01-01". Raises an error if the account_id is invalid or the user lacks analytics permissions for the specified account."workers-ai" or "bot-management". Raises an error if the account lacks AI analytics access or Workers AI is not enabled.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			dimension: AiDimensionParam,
			normalization: AiNormalizationParam,
		},
		async ({
			dateRange,
			dateStart,
			dateEnd,
			asn,
			location,
			continent,
			dimension,
			normalization,
		}) => {
			try {
				const props = getProps(agent)

				const result = await fetchRadarApi(props.accessToken, `/ai/${dimension}`, {
					asn,
					continent,
					location,
					dateRange,
					dateStart,
					dateEnd,
					normalization,
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
		'Retrieve BGP hijack events and security incidents from Cloudflare's threat intelligence system. Use when the user wants to investigate network security threats, analyze routing anomalies, or monitor BGP-related attacks affecting their infrastructure. Accepts `start_date` and `end_date` (optional timestamp filters), `ip_prefix` (optional CIDR block), and `limit` (optional result count). e.g., start_date="2024-01-01", ip_prefix="192.168.1.0/24". Do not use when you need general Cloudflare documentation or configuration help (use search_cloudflare_documentation instead). Returns an error if the account lacks access to security analytics features.'s network security monitoring. Use when the user wants to investigate suspicious routing announcements, analyze network security incidents, or monitor unauthorized AS route advertisements. Accepts `start_date`, `end_date` (optional date range), `asn` (optional target AS number), and `prefix` (optional IP prefix filter). e.g., asn=64512, prefix="192.0.2.0/24". Returns error if the date range exceeds the maximum query window or invalid ASN format is provided. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead).',
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
		'Retrieve BGP route leak events and anomalies from Cloudflare's network monitoring system. Use when the user wants to investigate network routing issues, analyze BGP hijacks, or monitor route leak incidents affecting internet traffic. Accepts `start_time` and `end_time` (optional datetime filters), `asn` (optional autonomous system number), and `leak_type` (optional filter). e.g., asn=13335, leak_type="hijack". Do not use when you need general Cloudflare documentation or account information (use search_cloudflare_documentation or accounts_list instead). Returns an error if the time range exceeds the maximum query window or if invalid ASN format is provided.'s network monitoring system. Use when the user wants to investigate network routing anomalies, analyze AS path violations, or troubleshoot connectivity issues caused by improper route announcements. Accepts `start_time` and `end_time` (optional datetime filters), `asn` (optional autonomous system number), and `limit` (optional result count). e.g., asn=64512, start_time="2024-01-01T00:00:00Z". Do not use when you need general network metrics or performance data (use other monitoring tools instead). Returns an error if the specified time range exceeds the maximum query window or if invalid ASN format is provided.',
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
		'Retrieve BGP routing table statistics including total route counts, origin AS numbers, and network prefixes. Use when the user wants to analyze internet routing data, monitor BGP table growth, or investigate network reachability patterns. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts optional filtering parameters such as `prefix` (CIDR notation) and `asn` (autonomous system number), e.g., prefix="192.168.1.0/24" or asn=13335. Raises an error if the specified prefix format is invalid or the ASN does not exist."192.168.0.0/16" or asn="64512". Raises an error if the BGP data source is temporarily unavailable or rate limits are exceeded.',
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
		'Retrieve bot traffic analytics and trends from Cloudflare including breakdowns by bot name, operator, category, and type. Use when the user wants to analyze automated traffic patterns, monitor crawler activity, or investigate bot behavior on their websites. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `zone_id` (required), `since` and `until` (optional date filters), and `dimensions` (optional: bot_name, operator, category, kind). e.g., dimensions= for all dimensions or specific values. Raises an error if the zone does not exist or access is denied."bot_name,category" to group by both bot name and category. Do not use when you need general website analytics or human traffic data (use other analytics tools instead). Raises an error if the zone ID is invalid or the account lacks Bot Management entitlements.',
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
		'Retrieve Certificate Transparency log data for SSL/TLS certificates issued to specific domains. Use when the user wants to monitor certificate issuance, investigate potential security threats, or audit SSL certificate history for domain security analysis. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `domain` (required string) and optional `limit` parameter to control result count, e.g., domain="example.com", limit=50. Returns error if the domain format is invalid or the Certificate Transparency logs are temporarily unavailable."example.com" or domain="*.cloudflare.com" for wildcard certificates. Returns error if the domain format is invalid or CT logs are temporarily unavailable. Do not use when you need to manage Cloudflare-issued certificates or SSL settings (use Cloudflare SSL management tools instead).',
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
			normalization: CtNormalizationParam,
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
			normalization,
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
					normalization,
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
		'Retrieve NetFlows traffic data showing network communication patterns and bandwidth usage across geographic regions. Use when the user wants to analyze network traffic flows, monitor data transfer patterns, or investigate connectivity between locations. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `geoId` (optional) to filter by ADM1 administrative regions such as states or provinces, e.g., "US-CA" for California or "GB-ENG" for England. Raises an error if the specified geoId format is invalid or the region code does not exist. "US-CA" for California or "GB-ENG" for England. Do not use when you need to query application-specific logs or database records (use d1_database_query instead). Raises an error if the specified geoId format is invalid or the region is not supported.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			geoId: GeoIdArrayParam,
			product: NetflowsProductParam,
			normalization: NetflowsNormalizationParam,
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

				const endpoint = `/netflows/${dimension}`

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
		'List available cloud provider origins and their regions in Cloud Observatory. Use when the user wants to discover which hyperscalers and geographic regions are supported for cloud monitoring or analysis. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `filter` (optional string for specific providers). Returns data for Amazon (AWS), Google (GCP), Microsoft (Azure), and Oracle (OCI) with their respective regional availability, e.g., "us-east-1" or "europe-west1". Raises an error if the Cloud Observatory service is unavailable. "AWS" with regions such as "us-east-1", "eu-west-1". Do not use when you need to query specific account data from these providers (use the respective provider-specific tools instead). Fails if the Cloud Observatory service is unavailable.',
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
		'Retrieve details for a specific cloud provider origin, including all available regions and configuration settings. Use when the user wants to inspect or review the configuration of an existing origin before making changes or troubleshooting connectivity issues. Do not use when you need to search for documentation or guidance (use search_cloudflare_documentation instead). Accepts `origin_id` (required) to specify which origin to retrieve. e.g., origin_id="12345". Raises an error if the origin_id does not exist or is inaccessible."aws-us-east-1-origin" or origin_id="gcp-europe-west1". Returns error if the origin ID does not exist or access is denied. Do not use when you need to list all available origins (use a list origins tool instead).',
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
		'Retrieve cloud provider performance metrics and analytics data from AWS, GCP, Azure, and OCI origins. Use when the user wants to analyze performance trends, compare regional metrics, or generate reports on success rates and response times. Do not use when you need R2 bucket-specific metrics (use r2_metrics_list instead). Accepts `provider` (required: "aws", "gcp", "azure", or "oci"), `region` (optional), and `time_range` (optional). e.g., provider="aws", region="us-east-1", time_range="24h". Raises an error if the specified provider or region is not supported. "aws", "gcp", "azure", "oci"), `metric_type` (optional: "timeseries", "summary", "grouped"), `region` (optional), and `time_range` (optional). e.g., provider="aws", metric_type="timeseries", region="us-east-1". Returns error if the specified provider or region is not supported. Do not use when you need R2 storage metrics (use r2_metrics_list instead).',
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
		'Retrieve robots.txt analysis data showing how websites configure crawler access rules and AI bot permissions. Use when the user wants to analyze web crawler policies, check bot access restrictions, or understand site crawling configurations across domains. Do not use when you need to search Cloudflare-specific documentation or configuration (use search_cloudflare_documentation instead). Accepts `domain` or `url` (required) parameters, e.g., "example.com" or "https://example.com/robots.txt". Raises an error if the domain is unreachable or does not have a robots.txt file. "example.com" or "https://site.com/robots.txt". Returns structured data including allowed/disallowed paths, crawl delays, and sitemap locations for various user agents such as Googlebot, GPTBot, or ChatGPT-User. Raises an error if the domain is unreachable or robots.txt file is malformed. Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead).',
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
			normalization: RobotsTxtNormalizationParam,
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
			normalization,
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
					normalization,
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
		'Retrieve web crawler HTTP request data showing traffic patterns by client type, user agent, referrer, and industry. Use when the user wants to analyze bot behavior, monitor crawler activity, or investigate suspicious automated traffic on their Cloudflare-protected domains. Do not use when you need general analytics data (use other analytics tools instead). Accepts `zone_id` (required), `date_range` (optional), and `filter` parameters for specific crawler types, e.g., zone_id="abc123def456", date_range="7d", filter="googlebot". Raises an error if the zone is not accessible or does not exist."abc123", filter="googlebot". Returns error if the zone does not exist or analytics are not enabled for the account.',
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
		'List known bots with their details including AI crawlers, search engines, and monitoring bots. Use when the user wants to identify, categorize, or analyze bot traffic patterns and verification status. Do not use when you need to search Cloudflare documentation about bot management (use search_cloudflare_documentation instead). Accepts `category` (optional: filter by bot type), `operator` (optional: filter by company), `kind` (optional: filter by purpose), and `verification_status` (optional: verified/unverified). e.g., category="search_engine" or operator="Google". Returns an error if the API request fails or authentication is invalid."search_engine", operator="Google", kind="crawler". Do not use when you need to search Cloudflare-specific documentation about bot management (use search_cloudflare_documentation instead). Returns an error if invalid filter parameters are provided.',
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
		'Retrieve detailed information about a specific bot by its slug identifier. Use when the user wants to inspect configuration, settings, or metadata for a particular Cloudflare bot. Do not use when you need to search documentation about bots (use search_cloudflare_documentation instead). Accepts `slug` (required string identifier), e.g., "good-bot" or "security-scanner". Raises an error if the bot slug does not exist or you lack permissions to access it. "my-chatbot" or "support-assistant". Do not use when you need to list all available bots (use a general listing tool instead). Raises an error if the bot slug does not exist or you lack permissions to access it.',
		{
			botSlug: SlugParam.describe('The bot slug identifier (e.g., "googlebot", "bingbot").'),
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
	// TODO: Add normalization (PERCENTAGE_CHANGE, MIN0_MAX) once the radar API
	// supports it on leaked_credential_checks v2 timeseries_groups.
	// ============================================================

	agent.server.tool(
		'get_leaked_credentials_data',
		'Retrieve trends and analytics for HTTP authentication requests and compromised credential detection across your Cloudflare account. Use when the user wants to analyze security threats, review credential breach patterns, or monitor authentication attack trends. Shows distribution data by compromised status and bot classification categories. Accepts optional time range parameters such as `start_date` and `end_date` for filtering results, e.g., last 30 days or specific incident timeframes. Do not use when you need to search general Cloudflare documentation or configuration guides (use search_cloudflare_documentation instead). Returns an error if the account lacks Security Analytics access or if the specified date range is invalid.',
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
		'Retrieve AS112 DNS sink hole data for analyzing reverse DNS lookup patterns and misconfigurations. Use when the user wants to investigate DNS traffic patterns for private IP addresses or diagnose RFC 1918 reverse DNS issues. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts optional filtering parameters such as `time_range` and `query_type`. e.g., analyzing queries for 10.0.0.0/8 or 192.168.0.0/16 address ranges. Returns error if the AS112 service is temporarily unavailable or rate limits are exceeded.',
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
		'List available administrative divisions (states, provinces, regions) with their GeoNames IDs for geographic filtering. Use when the user wants to find specific geographic regions to filter Cloudflare HTTP logs or NetFlows data by location. Do not use when you need to query actual traffic data (use appropriate analytics tools instead). Accepts no required parameters but may support optional filtering by `country_code` or `region_type`. e.g., returns entries like "California (US-CA, ID: 5332921)" or "Ontario (CA-ON, ID: 6093943)". Raises an error if the GeoNames service is unavailable or rate limits are exceeded. "California (US-CA, GeoNames ID: 5332921)" or "Ontario (CA-ON, GeoNames ID: 6093943)". Raises an error if the GeoNames service is unavailable or rate-limited.',
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
		'Retrieve detailed information for a specific geographic location using its GeoNames ID. Use when the user wants to get comprehensive location data including coordinates, population, timezone, and administrative details for a known GeoNames identifier. Accepts `geonames_id` (required integer), e.g., 2643743 for London or 5128581 for New York City. Do not use when you need to search for locations by name or coordinates (use location search tools instead). Returns error if the GeoNames ID does not exist or the service is unavailable.',
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
		'Retrieve TCP connection quality metrics including resets and timeouts for network reliability analysis. Use when the user wants to diagnose connection issues, monitor network performance, or analyze TCP reliability patterns across different locations. Do not use when you need general documentation about Cloudflare networking (use search_cloudflare_documentation instead). Accepts `zone_id` (required), `time_range` (optional), and `location_filters` (optional array). e.g., zone_id="abc123def456", time_range="24h", location_filters=["US", "EU"]. Raises an error if the zone_id is invalid or the account lacks analytics permissions."abc123", time_range="24h", location_filters=["US", "EU"]. Do not use when you need general R2 or D1 performance metrics (use r2_metrics_list or d1_database_query instead). Returns error if the zone ID is invalid or analytics data is unavailable for the specified time range.',
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
		'Retrieve annotations including Internet events, outages, and anomalies from various Cloudflare data sources. Use when the user wants to investigate network incidents, analyze service disruptions, or review historical Internet events affecting Cloudflare infrastructure. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `start_date`, `end_date` (optional date range), `event_type` (optional filter), and `data_source` (optional source specification). e.g., event_type="outage" or data_source="radar". Raises an error if the date range is invalid or exceeds the maximum allowed query period."outage" or data_source="radar". Raises an error if the date range exceeds the maximum allowed query window or if authentication fails.',
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
		'Retrieve Internet outages and connectivity anomalies across autonomous systems and geographic locations. Use when the user wants to investigate network disruptions, monitor global connectivity issues, or analyze Internet infrastructure problems. Do not use when you need to search Cloudflare-specific documentation or troubleshoot Cloudflare services (use search_cloudflare_documentation instead). Accepts `location` (optional geographic filter), `asn` (optional autonomous system number), and `time_range` (optional duration filter). e.g., location="United States", asn=13335, time_range="24h". Returns error if the API service is unavailable or rate limits are exceeded."US-CA" or asn="13335" for Cloudflare's network. Returns error if the API rate limit is exceeded or invalid ASN format is provided. Do not use when you need to query specific Cloudflare service metrics (use r2_metrics_list or other service-specific tools instead).',
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
		'List Certificate Authorities (CAs) tracked in Certificate Transparency logs. Use when the user wants to review, audit, or investigate which certificate authorities are issuing certificates for domains. Do not use when you need to search Cloudflare-specific documentation or manage Cloudflare services (use search_cloudflare_documentation or other Cloudflare tools instead). Accepts optional filtering parameters such as `domain` and `log_name`, e.g., filtering by specific CT log sources like "Google Argon" or domain "example.com". Returns error if the CT log service is unavailable or rate limits are exceeded. "Google Argon" or "Cloudflare Nimbus". Returns an error if the Certificate Transparency service is unavailable or rate limits are exceeded.',
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
		'Retrieve detailed information about a specific Certificate Authority using its SHA256 fingerprint. Use when the user wants to inspect or verify CA certificate details, validation status, or trust chain information. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `fingerprint` (required SHA256 hash string), e.g., fingerprint="a1b2c3d4e5f6...". Raises an error if the fingerprint is invalid or the CA is not found in the certificate transparency logs."a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456". Raises an error if the fingerprint format is invalid or the CA is not found in Cloudflare's database.',
		{
			caSlug: Sha256FingerprintParam.describe(
				'The Certificate Authority SHA256 fingerprint (64 hexadecimal characters).'
			),
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
		'List Certificate Transparency logs available in Cloudflare. Use when the user wants to view or inspect CT log endpoints for certificate monitoring and transparency compliance. Accepts no required parameters but may include optional filtering parameters. e.g., retrieving logs for certificate validation or audit purposes. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Returns an error if the API request fails or authentication is invalid.',
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
		'Retrieve detailed information about a specific Certificate Transparency log using its unique identifier. Use when the user wants to inspect CT log properties, configuration details, or operational status for a particular log. Do not use when you need to search or browse multiple CT logs (use search_cloudflare_documentation instead). Accepts `slug` (required string identifier for the CT log), e.g., "google-pilot" or "cloudflare-nimbus2021". Raises an error if the slug does not match any existing CT log. "google-pilot" or "cloudflare-nimbus2024". Do not use when you need general Cloudflare account information (use accounts_list instead). Raises an error if the slug does not correspond to an existing Certificate Transparency log.',
		{
			logSlug: SlugParam.describe('The Certificate Transparency log slug identifier.'),
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
		'Retrieve BGP updates time series data showing announcement and withdrawal patterns over time. Use when the user wants to analyze BGP routing changes, monitor network stability, or investigate connectivity issues across specific time periods. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `prefix` (optional IP prefix), `start_time` and `end_time` (required timestamps), and `asn` (optional autonomous system number). e.g., prefix="192.168.1.0/24", start_time="2024-01-01T00:00:00Z", end_time="2024-01-02T00:00:00Z". Raises an error if the time range exceeds the maximum allowed query window or if timestamps are malformed."192.0.2.0/24", start_time="2024-01-01T00:00:00Z". Do not use when you need real-time BGP routing table data (use a live BGP lookup tool instead). Returns error if the time range exceeds the maximum allowed query window or if invalid timestamp formats are provided.',
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
		'Retrieve the top Autonomous Systems ranked by BGP update count from Cloudflare's network intelligence data. Use when the user wants to analyze BGP routing activity, identify the most active network operators, or investigate internet routing patterns. Accepts optional `limit` parameter to control the number of results returned. e.g., limit=50 to get the top 50 ASes by update volume. Returns error if Cloudflare's BGP data service is temporarily unavailable. Do not use when you need account-specific Cloudflare resources like databases or workers (use the respective d1_ or workers_ tools instead).'s network analytics. Use when the user wants to analyze network traffic patterns, identify high-activity ASes, or investigate BGP routing behavior. Accepts `limit` (optional, number of results), `time_range` (optional, e.g., "1h", "24h", "7d"), and `order` (optional, "asc" or "desc"). e.g., limit=10, time_range="24h". Returns error if the time range is invalid or exceeds API limits. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead).',
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
		'Retrieve the top IP prefixes ranked by BGP update count from Cloudflare's global network data. Use when the user wants to analyze network traffic patterns, identify the most active IP address ranges, or investigate BGP routing activity. Accepts `limit` (optional, number of results) and `time_period` (optional, filtering timeframe). e.g., retrieving the top 100 most updated prefixes from the last 24 hours. Returns an error if the Cloudflare API is unavailable or rate limits are exceeded. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead).'s network analytics. Use when the user wants to analyze network traffic patterns, identify high-activity IP ranges, or investigate BGP routing behavior. Accepts `limit` (optional, number of results to return) and `time_range` (optional, analysis period). e.g., limit=10 for top 10 prefixes or time_range="24h" for last day. Returns an error if the account lacks access to BGP analytics or if the time range is invalid. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead).',
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
		'Retrieve Multi-Origin AS (MOAS) prefixes that are announced by multiple Autonomous Systems. Use when the user wants to investigate potential BGP hijacking incidents or analyze legitimate anycast deployments across multiple ASes. Do not use when you need general Cloudflare account or service information (use other Cloudflare tools instead). Accepts `prefix` (optional IP prefix to filter results) and `asn` (optional AS number to focus on). e.g., prefix="192.0.2.0/24" or asn=64512. Returns error if the BGP data service is unavailable or the prefix format is invalid."192.0.2.0/24" or asn="64512". Returns error if the BGP data source is temporarily unavailable. Do not use when you need to search Cloudflare-specific documentation or configuration details (use search_cloudflare_documentation instead).',
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
		'Retrieve prefix-to-ASN mapping for a given IP prefix to identify which Autonomous System announces it. Use when the user wants to investigate network routing, trace IP ownership, or analyze BGP announcements for security or troubleshooting purposes. Do not use when you need to query Cloudflare-specific services or databases (use the appropriate Cloudflare tools instead). Accepts `prefix` (required IP prefix in CIDR notation), e.g., "192.0.2.0/24" or "2001:db8::/32". Returns error if the prefix format is invalid or the BGP data is unavailable.',
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
		'Retrieve time series data showing announced IPv4 /24 and IPv6 /48 address space counts over time for BGP monitoring. Use when the user wants to analyze routing announcements, track IP space changes, monitor route withdrawals, or detect significant BGP events by ASN or country. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `asn` (optional), `country` (optional), `start_date`, and `end_date` (required) parameters with ISO format dates. e.g., asn=13335 for Cloudflare, start_date="2024-01-01", end_date="2024-01-31". Raises an error if the date range is invalid or exceeds the maximum allowed timespan.'s network or country="US" for United States announcements. Returns error if the date range exceeds API limits or ASN format is invalid. Do not use when you need real-time BGP route table data (use a live BGP monitoring tool instead).',
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
		'Retrieve real-time BGP routes for a specific IP prefix using public route collectors. Use when the user wants to troubleshoot routing issues, verify route announcements, or analyze current BGP visibility across internet peers. Do not use when you need to search Cloudflare-specific documentation or configuration (use search_cloudflare_documentation instead). Accepts `prefix` (required IP prefix), e.g., "192.0.2.0/24" or "2001:db8::/32". Raises an error if the prefix format is invalid or no route data is available from collectors. "8.8.8.0/24" or "2001:4860::/32". Returns AS paths, RPKI validation status, and peer visibility from RouteViews and RIPE RIS collectors. Do not use when you need to manage Cloudflare-specific routing or DNS settings (use other Cloudflare tools instead). Raises an error if the prefix format is invalid or collectors are unreachable.',
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
		'Retrieve IRR AS-SETs that an Autonomous System is a member of for routing policy analysis. Use when the user wants to identify which AS-SET groups contain a specific autonomous system number. Accepts `asn` (required autonomous system number). e.g., ASN 64512 or AS15169. Returns an error if the ASN is invalid or not found in IRR databases. Do not use when you need to query Cloudflare-specific network configurations (use search_cloudflare_documentation instead).',
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
		'Retrieve AS-level relationships for an Autonomous System, showing peer, upstream, and downstream connections with other ASes. Use when the user wants to analyze network topology, investigate routing relationships, or understand AS interconnections for a specific autonomous system. Accepts `asn` (required autonomous system number). e.g., ASN 13335 for Cloudflare or ASN 15169 for Google. Returns error if the ASN does not exist or is not publicly routable. Do not use when you need to search Cloudflare documentation or manage Cloudflare resources (use search_cloudflare_documentation or respective account management tools instead).',
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
		'List top-level domains (TLDs) including generic, country-code, and sponsored TLDs with optional filtering capabilities. Use when the user wants to browse available domain extensions, research TLD types, or validate domain naming options. Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead). Accepts `type` (optional: "generic", "country-code", or "sponsored") for filtering results. e.g., type="generic" returns .com, .org, .net extensions. Returns an error if an invalid type parameter is provided. "generic", "country-code", or "sponsored") and `manager` (optional: registry organization name) parameters. e.g., type="generic" for .com/.org extensions or manager="Verisign" for specific registry domains. Returns an error if an invalid TLD type is specified. Do not use when you need to manage Cloudflare-specific resources like databases or workers (use the respective d1_ or workers_ tools instead).',
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
				const result = await fetchRadarApi(props.accessToken, '/tlds', {
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
		'Retrieve detailed information about a specific top-level domain (TLD) including registration policies, pricing, and availability status. Use when the user wants to research domain extension details, compare TLD options, or understand registration requirements for a specific domain suffix. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `tld` (required string), e.g., "com", "org", or "io". Raises an error if the TLD is not recognized or supported by the registry. "com", "org", or "io". e.g., tld="dev" or tld="co.uk". Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Raises an error if the TLD is not recognized or supported by Cloudflare.',
		{
			tld: TldParam,
		},
		async ({ tld }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, `/tlds/${tld}`)

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
		'Retrieve domain ranking timeseries data to track how specific domains perform over time. Use when the user wants to analyze domain ranking trends, monitor SEO performance changes, or compare historical ranking positions across different time periods. Do not use when you need to search Cloudflare documentation or manage Cloudflare services (use search_cloudflare_documentation or other Cloudflare tools instead). Accepts `domain` (required), `start_date` and `end_date` (optional date range), and `metrics` (optional ranking indicators). e.g., domain="example.com", start_date="2024-01-01", end_date="2024-12-31". Raises an error if the domain format is invalid or the date range exceeds API limits."example.com", start_date="2024-01-01", end_date="2024-03-01". Do not use when you need to search Cloudflare documentation for ranking concepts (use search_cloudflare_documentation instead). Raises an error if the domain has insufficient historical data or the date range exceeds available records.',
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
		'Retrieve speed test histogram data showing the distribution of network performance measurements. Use when the user wants to analyze patterns, trends, or statistical distribution of bandwidth, latency, or jitter test results over time. Do not use when you need to search for documentation about speed testing (use search_cloudflare_documentation instead). Accepts `metric_type` (required: "bandwidth", "latency", or "jitter"), `time_range` (optional), and `bin_count` (optional). e.g., metric_type="bandwidth", time_range="7d". Raises an error if the metric type is invalid or no speed test data exists for the specified parameters. "bandwidth", "latency", or "jitter"), `time_range` (optional), and `account_id` (optional). e.g., metric_type="bandwidth" for download/upload speed distributions or metric_type="latency" for response time patterns. Returns error if no speed test data exists for the specified parameters. Do not use when you need to run new speed tests or get real-time metrics (use other monitoring tools instead).',
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

	// ============================================================
	// Internet Services Timeseries Tool
	// ============================================================

	agent.server.tool(
		'get_internet_services_timeseries',
		'Retrieve historical ranking data for internet services to analyze performance trends over time. Use when the user wants to monitor, compare, or analyze how services like ChatGPT, Google, or other platforms have changed in popularity or ranking metrics across different time periods. Do not use when you need to query current Cloudflare database records (use d1_database_query instead). Accepts `service_name` (required), `start_date` and `end_date` (optional date range parameters), and `metric_type` (optional ranking criteria). e.g., service_name="ChatGPT", start_date="2023-01-01", end_date="2023-12-31". Raises an error if the service name is not found in the historical data or if the date range is invalid."ChatGPT", start_date="2024-01-01", end_date="2024-12-31". Raises an error if the specified service has no historical data available.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			serviceCategory: InternetServicesCategoryParam.optional(),
			limit: PaginationLimitParam,
		},
		async ({ dateRange, dateStart, dateEnd, serviceCategory, limit }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(
					props.accessToken,
					'/ranking/internet_services/timeseries_groups',
					{
						dateRange,
						dateStart,
						dateEnd,
						serviceCategory,
						limit,
					}
				)

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
							text: `Error getting internet services timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Outages by Location Tool
	// ============================================================

	agent.server.tool(
		'get_outages_by_location',
		'Retrieve outage counts aggregated by geographic location to identify regions with the most Internet disruptions. Use when the user wants to analyze global Internet outage patterns, compare outage frequencies across countries, or identify hotspots of connectivity issues. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `location` (optional filter for specific countries or regions) and `time_range` (optional period specification). e.g., location="United States" or location="Europe". Returns error if the specified location format is invalid or time range exceeds API limits."United States" or time_range="last_7_days". Returns error if the outage data service is unavailable or rate limits are exceeded. Do not use when you need to query specific database tables (use d1_database_query instead).',
		{
			limit: PaginationLimitParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
		},
		async ({ limit, dateRange, dateStart, dateEnd }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/annotations/outages/locations', {
					limit,
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
							text: `Error getting outages by location: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// Traffic Anomalies by Location Tool
	// ============================================================

	agent.server.tool(
		'get_traffic_anomalies_by_location',
		'Retrieve traffic anomalies aggregated by location to identify countries with the most detected outage signals. Use when the user wants to analyze global internet connectivity issues or investigate regional network disruptions detected by Cloudflare Radar. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `location` (optional country code), `since` (optional timestamp), and `until` (optional timestamp) parameters, e.g., location="US" or since="2024-01-01T00:00:00Z". Raises an error if the timestamp format is invalid or the location code is not recognized. "US" or "EU" during network incidents. Returns error if the Radar API is unavailable or rate limits are exceeded. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead).',
		{
			limit: PaginationLimitParam,
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			status: TrafficAnomalyStatusParam,
		},
		async ({ limit, dateRange, dateStart, dateEnd, status }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/traffic_anomalies/locations', {
					limit,
					dateRange,
					dateStart,
					dateEnd,
					status,
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
							text: `Error getting traffic anomalies by location: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// BGP Routing Table ASes Tool
	// ============================================================

	agent.server.tool(
		'get_bgp_routing_table_ases',
		'List all Autonomous Systems (ASes) in global BGP routing tables with comprehensive routing statistics including prefix counts, IPv4/IPv6 address counts, and RPKI validation status. Use when the user wants to analyze global internet routing infrastructure, investigate AS-level connectivity, or audit RPKI deployment across the internet. Do not use when you need to query specific Cloudflare network data (use other Cloudflare tools instead). Accepts no required parameters but may include optional filtering parameters. Data sourced from public BGP MRT archives, e.g., RouteViews or RIPE RIS collectors. Returns an error if BGP data feeds are temporarily unavailable or corrupted.',
		{
			limit: PaginationLimitParam,
			location: LocationParam.optional(),
			sortBy: BgpRoutesAsesSortByParam,
			sortOrder: BgpSortOrderParam,
		},
		async ({ limit, location, sortBy, sortOrder }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/routes/ases', {
					limit,
					location,
					sortBy,
					sortOrder,
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
							text: `Error getting BGP routing table ASes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// BGP Top ASes by Prefixes Tool
	// ============================================================

	agent.server.tool(
		'get_bgp_top_ases_by_prefixes',
		'Retrieve top autonomous systems (ASes) ranked by their announced BGP prefix count. Use when the user wants to identify which networks have the largest routing footprint or analyze BGP announcement patterns across major internet providers. Accepts `limit` (optional, defaults to 10) to control the number of results returned. Data comes from public BGP MRT archives and updates every 2 hours, e.g., showing that major cloud providers like AWS or Google typically announce thousands of prefixes. Returns an error if the BGP data service is temporarily unavailable. Do not use when you need to query specific Cloudflare infrastructure data (use the appropriate Cloudflare-specific tools instead).',
		{
			limit: PaginationLimitParam,
			country: LocationParam.optional().describe('Filter by country (alpha-2 code).'),
		},
		async ({ limit, country }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/top/ases/prefixes', {
					limit,
					country,
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
							text: `Error getting BGP top ASes by prefixes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// ============================================================
	// BGP RPKI ASPA Tools
	// ============================================================

	agent.server.tool(
		'get_bgp_rpki_aspa_snapshot',
		'Retrieve a snapshot of current or historical RPKI ASPA (Autonomous System Provider Authorization) objects from Cloudflare's BGP routing security database. Use when the user wants to analyze BGP route validation data, audit ASPA records, or investigate routing security policies. Accepts `timestamp` (optional for historical snapshots) and `format` (optional output format). e.g., timestamp="2024-01-15T10:00:00Z" for historical data or current snapshot if omitted. Returns error if the timestamp is invalid or too far in the past. Do not use when you need general Cloudflare documentation (use search_cloudflare_documentation instead).'s BGP routing security database. Use when the user wants to analyze BGP route authorization policies, investigate routing security configurations, or audit upstream provider relationships for specific ASNs. Accepts `asn` (optional target AS number), `timestamp` (optional for historical data), and `format` (optional: "json" or "csv"). e.g., asn=64512 for a specific autonomous system or timestamp="2024-01-15T10:00:00Z" for historical data. Returns error if the requested timestamp is outside the available data retention period. Do not use when you need general Cloudflare account information (use accounts_list instead).',
		{
			customerAsn: AspaCustomerAsnParam,
			providerAsn: AspaProviderAsnParam,
			rir: AspaRirParam,
			location: LocationParam.optional().describe('Filter by country (alpha-2 code).'),
			date: AspaDateParam,
			page: AspaPageParam,
			per_page: AspaPerPageParam,
			sortBy: AspaSortByParam,
			sortOrder: BgpSortOrderParam,
		},
		async ({
			customerAsn,
			providerAsn,
			rir,
			location,
			date,
			page,
			per_page,
			sortBy,
			sortOrder,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/rpki/aspa/snapshot', {
					customerAsn,
					providerAsn,
					rir,
					location,
					date,
					page,
					per_page,
					sortBy,
					sortOrder,
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
							text: `Error getting BGP RPKI ASPA snapshot: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_rpki_aspa_changes',
		'Retrieve RPKI ASPA changes over time, including additions, removals, and modifications of ASPA objects. Use when the user wants to track historical changes to Autonomous System Provider Authorization records for network security analysis. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `time_range` (optional date range), `asn` (optional Autonomous System Number filter), and `change_type` (optional: "addition", "removal", or "modification"). e.g., asn="64512" or change_type="addition". Raises an error if the time range format is invalid or the ASN is not found. "addition", "removal", or "modification"). e.g., asn="64512", change_type="addition". Returns error if the specified time range exceeds the maximum query window or if invalid ASN format is provided.',
		{
			customerAsn: AspaCustomerAsnParam,
			providerAsn: AspaProviderAsnParam,
			changeType: AspaChangeTypeParam,
			rir: AspaRirParam,
			location: LocationParam.optional().describe('Filter by country (alpha-2 code).'),
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
			sortBy: AspaSortByParam,
			sortOrder: BgpSortOrderParam,
			page: AspaPageParam,
			per_page: AspaPerPageParam,
		},
		async ({
			customerAsn,
			providerAsn,
			changeType,
			rir,
			location,
			dateRange,
			dateStart,
			dateEnd,
			sortBy,
			sortOrder,
			page,
			per_page,
		}) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/rpki/aspa/changes', {
					customerAsn,
					providerAsn,
					changeType,
					rir,
					location,
					dateRange,
					dateStart,
					dateEnd,
					sortBy,
					sortOrder,
					page,
					per_page,
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
							text: `Error getting BGP RPKI ASPA changes: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_bgp_rpki_aspa_timeseries',
		'Retrieve historical timeseries data showing RPKI ASPA (Autonomous System Provider Authorization) object counts over time. Use when the user wants to analyze trends, monitor growth, or track changes in RPKI ASPA deployment metrics across specific time periods. Do not use when you need general Cloudflare account information or database queries (use appropriate Cloudflare tools instead). Accepts `start_date`, `end_date` (ISO 8601 format), and optional `granularity` parameters such as "daily" or "weekly". e.g., start_date="2024-01-01", end_date="2024-12-31", granularity="monthly". Raises an error if the date range is invalid or exceeds the maximum allowed timespan. "daily" or "hourly". e.g., start_date="2024-01-01T00:00:00Z", end_date="2024-12-31T23:59:59Z". Returns an error if the date range exceeds the maximum allowed query window or if invalid date formats are provided. Do not use when you need real-time BGP routing data (use other BGP monitoring tools instead).',
		{
			rir: AspaRirParam,
			location: LocationParam.optional().describe('Filter by country (alpha-2 code).'),
			dateRange: DateRangeParam.optional(),
			dateStart: DateStartParam.optional(),
			dateEnd: DateEndParam.optional(),
		},
		async ({ rir, location, dateRange, dateStart, dateEnd }) => {
			try {
				const props = getProps(agent)
				const result = await fetchRadarApi(props.accessToken, '/bgp/rpki/aspa/timeseries', {
					rir,
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
							text: `Error getting BGP RPKI ASPA timeseries: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
