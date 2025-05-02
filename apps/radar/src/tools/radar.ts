import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { PaginationLimitParam, PaginationOffsetParam } from '@repo/mcp-common/src/types/shared'

import {
	AsnArrayParam,
	AsnParam,
	AsOrderByParam,
	ContinentArrayParam,
	DataFormatParam,
	DateEndArrayParam,
	DateEndParam,
	DateListParam,
	DateRangeArrayParam,
	DateRangeParam,
	DateStartArrayParam,
	DateStartParam,
	DomainParam,
	DomainRankingTypeParam,
	HttpDimensionParam,
	IpParam,
	L7AttackDimensionParam,
	LocationArrayParam,
	LocationListParam,
	LocationParam,
} from '../types/radar'

import type { RadarMCP } from '../index'

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
		'get_http_requests_data',
		'Retrieve HTTP requests traffic trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			format: DataFormatParam,
			dimension: HttpDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, format, dimension }) => {
			try {
				if (format !== 'timeseries' && !dimension) {
					throw new Error(`The '${format}' format requires a 'dimension' to group the data.`)
				}

				const client = getCloudflareClient(agent.props.accessToken)
				const endpoint = (...args: any) =>
					format === 'timeseries'
						? client.radar.http[format](...args)
						: client.radar.http[format][dimension!](...args)

				const r = await endpoint({
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
		'get_l7_attack_data',
		'Retrieve application layer (L7) attack trends.',
		{
			dateRange: DateRangeArrayParam.optional(),
			dateStart: DateStartArrayParam.optional(),
			dateEnd: DateEndArrayParam.optional(),
			asn: AsnArrayParam,
			continent: ContinentArrayParam,
			location: LocationArrayParam,
			format: DataFormatParam,
			dimension: L7AttackDimensionParam,
		},
		async ({ dateStart, dateEnd, dateRange, asn, location, continent, format, dimension }) => {
			try {
				if (format !== 'timeseries' && !dimension) {
					throw new Error(`The '${format}' format requires a 'dimension' to group the data.`)
				}

				const client = getCloudflareClient(agent.props.accessToken)
				const endpoint = (...args: any) =>
					format === 'timeseries'
						? client.radar.attacks.layer7[format](...args)
						: client.radar.attacks.layer7[format][dimension!](...args)

				const r = await endpoint({
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
}
