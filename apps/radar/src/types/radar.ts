/**
 * This file contains the validators for the radar tools.
 */
import { z } from 'zod'

import type { HTTPTimeseriesParams, RankingTopParams } from 'cloudflare/resources/radar'
import type { ASNListParams } from 'cloudflare/resources/radar/entities'

export const AsnParam = z
	.number()
	.positive()
	.describe('Autonomous System Number (ASN), must be a positive number.')

export const IpParam = z.string().ip().describe('IPv4 or IPv6 address in standard notation.')

export const DomainParam = z
	.string()
	.regex(
		/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/
	)
	.describe(
		'A valid domain name, e.g., example.com or sub.domain.co.uk. Must follow standard domain formatting rules without protocol or path.'
	)

export const DomainRankingTypeParam: z.ZodType<RankingTopParams['rankingType']> = z
	.enum(['POPULAR', 'TRENDING_RISE', 'TRENDING_STEADY'])
	.describe('The ranking type.')

export const InternetServicesCategoryParam = z
	.array(
		z.enum([
			'Generative AI',
			'E-commerce',
			'Cryptocurrency Services',
			'Email',
			'Fast Fashion',
			'Financial Services',
			'News',
			'Social Media',
			'Weather',
			'Jobs',
			'Low cost E-commerce',
			'Messaging',
			'Metaverse & Gaming',
		])
	)
	.describe('Filters results by Internet service category.')

export const DateParam = z.string().date().describe('Filters results by date.')

export const DateListParam = z.array(DateParam).describe('Filters results by date.')

export const DateRangeParam = z
	.string()
	.toLowerCase()
	.regex(
		/^((([1-9]|[1-9][0-9]|[1-2][0-9][0-9]|3[0-5][0-9]|36[0-4])d(control)?)|(([1-9]|[1-4][0-9]|5[0-2])w(control)?))$/,
		'Invalid Date Range'
	)
	.describe(
		'Filters results by date range. ' +
			'For example, use `7d` and `7dcontrol` to compare this week with the previous week. ' +
			'Use this parameter or set specific start and end dates (`dateStart` and `dateEnd` parameters).'
	)

export const DateRangeArrayParam: z.ZodType<HTTPTimeseriesParams['dateRange']> = z
	.array(DateRangeParam)
	.describe(
		'Filters results by date range. ' +
			'For example, use `7d` and `7dcontrol` to compare this week with the previous week. ' +
			'Use this parameter or set specific start and end dates (`dateStart` and `dateEnd` parameters).'
	)

export const DateStartParam = z
	.string()
	.datetime()
	.describe(
		'Start date in ISO 8601 format (e.g., 2023-04-01T00:00:00Z). ' +
			'Either use this parameter together with `dateEnd`, or use `dateRange`.'
	)

export const DateStartArrayParam: z.ZodType<HTTPTimeseriesParams['dateStart']> = z
	.array(DateStartParam)
	.describe(
		'Start of the date range. ' +
			'Either use this parameter together with `dateEnd` or use `dateRange`.'
	)

export const DateEndParam = z
	.string()
	.datetime()
	.describe(
		'End date in ISO 8601 format (e.g., 2023-04-30T23:59:59Z). ' +
			'Either use this parameter together with `dateStart`, or use `dateRange`.'
	)

export const DateEndArrayParam: z.ZodType<HTTPTimeseriesParams['dateEnd']> = z
	.array(DateEndParam)
	.describe(
		'End of the date range. ' +
			'Either use this parameter together with `dateStart`, or use `dateRange`.'
	)

export const LocationParam = z
	.string()
	.regex(/^[a-zA-Z]{2}$/, {
		message:
			'Invalid location code. Must be a valid alpha-2 location code (two letters, case insensitive).',
	})
	.describe('Filters results by location. Specify a valid alpha-2 location code.')

export const LocationListParam: z.ZodType<RankingTopParams['location']> = z
	.array(LocationParam)
	.describe(
		'Filters results by location. Specify a comma-separated list of alpha-2 location codes.'
	)

export const LocationArrayParam: z.ZodType<HTTPTimeseriesParams['location']> = z
	.array(
		z.string().regex(/^(-?[a-zA-Z]{2})$/, {
			message: 'Each value must be a valid alpha-2 location code, optionally prefixed with `-`.',
		})
	)
	.optional()
	.describe(
		'Filters results by location. Provide an array of alpha-2 country codes (e.g., "US", "PT"). ' +
			'Prefix a code with `-` to exclude it (e.g., ["-US", "PT"] excludes the US and includes Portugal).'
	)

export const ContinentArrayParam: z.ZodType<HTTPTimeseriesParams['continent']> = z
	.array(
		z.string().regex(/^(-?[a-zA-Z]{2})$/, {
			message: 'Each value must be a valid alpha-2 continent code, optionally prefixed with `-`.',
		})
	)
	.optional()
	.describe(
		'Filters results by continent. Provide an array of alpha-2 continent codes (e.g., "EU", "NA"). ' +
			'Prefix a code with `-` to exclude it (e.g., ["-EU", "NA"] excludes Europe and includes North America).'
	)

export const AsnArrayParam: z.ZodType<HTTPTimeseriesParams['asn']> = z
	.array(z.string().refine((val) => val !== '0', { message: 'ASN cannot be 0' }))
	.optional()
	.describe(
		'Filters results by ASN. Provide an array of ASN strings. ' +
			'Prefix with `-` to exclude (e.g., ["-174", "3356"] excludes AS174 and includes AS3356). '
	)

export const AsOrderByParam: z.ZodType<ASNListParams['orderBy']> = z
	.enum(['ASN', 'POPULATION'])
	.optional()
	.describe('Optional order by parameter: "ASN" or "POPULATION".')

export const HttpDimensionParam = z
	.enum([
		'timeseries',
		'summary/deviceType',
		'summary/httpProtocol',
		'summary/httpVersion',
		'summary/botClass',
		'summary/ipVersion',
		'summary/tlsVersion',
		'summary/os',
		'summary/postQuantum',
		'top/browser', // TODO replace with "summary/browser" and "summary/browserFamily" once available on the lib
		'top/browserFamily',
		'timeseriesGroups/deviceType',
		'timeseriesGroups/httpProtocol',
		'timeseriesGroups/httpVersion',
		'timeseriesGroups/botClass',
		'timeseriesGroups/ipVersion',
		'timeseriesGroups/tlsVersion',
		'timeseriesGroups/os',
		'timeseriesGroups/postQuantum',
		'timeseriesGroups/browser',
		'timeseriesGroups/browserFamily',
		'top/locations',
		'top/ases',
	])
	.describe('Dimension indicating the type and format of HTTP data to retrieve.')

export const DnsDimensionParam = z
	.enum([
		'timeseries',
		'summary/ipVersion',
		'summary/cacheHit',
		'summary/dnssec',
		'summary/dnssecAware',
		'summary/matchingAnswer',
		'summary/protocol',
		'summary/queryType',
		'summary/responseCode',
		'summary/responseTTL',
		'timeseriesGroups/ipVersion',
		'timeseriesGroups/cacheHit',
		'timeseriesGroups/dnssecAware',
		'timeseriesGroups/matchingAnswer',
		'timeseriesGroups/protocol',
		'timeseriesGroups/queryType',
		'timeseriesGroups/responseCode',
		'timeseriesGroups/responseTTL',
		'top/locations',
		'top/ases',
	])
	.describe('Dimension indicating the type and format of DNS data to retrieve.')

export const L7AttackDimensionParam = z
	.enum([
		'timeseries',
		'summary/httpMethod',
		'summary/httpVersion',
		'summary/ipVersion',
		'summary/managedRules',
		'summary/mitigationProduct',
		'top/vertical', // TODO replace with "summary/vertical" and "summary/industry" once available on the lib
		'top/industry',
		'timeseriesGroups/httpMethod',
		'timeseriesGroups/httpVersion',
		'timeseriesGroups/ipVersion',
		'timeseriesGroups/managedRules',
		'timeseriesGroups/mitigationProduct',
		'timeseriesGroups/vertical',
		'timeseriesGroups/industry',
		'top/locations/origin',
		'top/locations/target',
		'top/ases/origin',
		'top/attacks',
	])
	.describe('Dimension indicating the type and format of L7 attack data to retrieve.')

export const L3AttackDimensionParam = z
	.enum([
		'timeseries',
		'summary/protocol',
		'summary/ipVersion',
		'summary/vector',
		'summary/bitrate',
		'summary/duration',
		'top/vertical', // TODO replace with "summary/vertical" and "summary/industry" once available on the lib
		'top/industry',
		'timeseriesGroups/protocol',
		'timeseriesGroups/ipVersion',
		'timeseriesGroups/vector',
		'timeseriesGroups/bitrate',
		'timeseriesGroups/duration',
		'timeseriesGroups/vertical',
		'timeseriesGroups/industry',
		'top/locations/origin',
		'top/locations/target',
		'top/attacks',
	])
	.describe('Dimension indicating the type and format of L3 attack data to retrieve.')

export const EmailRoutingDimensionParam = z
	.enum([
		'summary/ipVersion',
		'summary/encrypted',
		'summary/arc',
		'summary/dkim',
		'summary/dmarc',
		'summary/spf',
		'timeseriesGroups/ipVersion',
		'timeseriesGroups/encrypted',
		'timeseriesGroups/arc',
		'timeseriesGroups/dkim',
		'timeseriesGroups/dmarc',
		'timeseriesGroups/spf',
	])
	.describe('Dimension indicating the type and format of Email Routing data to retrieve.')

export const EmailSecurityDimensionParam = z
	.enum([
		'summary/spam',
		'summary/malicious',
		'summary/spoof',
		'summary/threatCategory',
		'summary/arc',
		'summary/dkim',
		'summary/dmarc',
		'summary/spf',
		'summary/tlsVersion',
		'timeseriesGroups/spam',
		'timeseriesGroups/malicious',
		'timeseriesGroups/spoof',
		'timeseriesGroups/threatCategory',
		'timeseriesGroups/arc',
		'timeseriesGroups/dkim',
		'timeseriesGroups/dmarc',
		'timeseriesGroups/spf',
		'timeseriesGroups/tlsVersion',
		'top/tlds',
	])
	.describe('Dimension indicating the type and format of Email Security data to retrieve.')

export const AiDimensionParam = z
	.enum([
		'bots/summary/userAgent',
		'bots/timeseriesGroups/userAgent',
		'inference/summary/model',
		'inference/summary/task',
		'inference/timeseriesGroups/model',
		'inference/timeseriesGroups/task',
	])
	.describe('Dimension indicating the type and format of AI data to retrieve.')

export const InternetSpeedDimensionParam = z
	.enum(['summary', 'top/locations', 'top/ases'])
	.describe('Dimension indicating the type and format of Internet speed data to retrieve.')

export const InternetSpeedOrderByParam = z
	.enum([
		'BANDWIDTH_DOWNLOAD',
		'BANDWIDTH_UPLOAD',
		'LATENCY_IDLE',
		'LATENCY_LOADED',
		'JITTER_IDLE',
		'JITTER_LOADED',
	])
	.describe('Specifies the metric to order the results by. Only allowed for top locations and ASes')

export const InternetQualityMetricParam = z
	.enum(['BANDWIDTH', 'DNS', 'LATENCY'])
	.describe('Specifies which metric to return (bandwidth, latency, or DNS response time).')
