import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import {
	PaginationLimitParam,
	PaginationOffsetParam,
} from '@repo/mcp-common/src/types/shared.types'

import {
	AiDimensionParam,
	AsnArrayParam,
	AsnParam,
	AsOrderByParam,
	ContinentArrayParam,
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
	HttpDimensionParam,
	InternetQualityMetricParam,
	InternetServicesCategoryParam,
	InternetSpeedDimensionParam,
	InternetSpeedOrderByParam,
	IpParam,
	L3AttackDimensionParam,
	L7AttackDimensionParam,
	LocationArrayParam,
	LocationListParam,
	LocationParam,
} from '../types/radar'
import { resolveAndInvoke } from '../utils'

import type { RadarMCP } from '../radar.app'

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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
			dimension: HttpDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, dimension }) => {
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await resolveAndInvoke(client.radar.http, dimension, {
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
				const client = getCloudflareClient(agent.props.accessToken)
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
}
