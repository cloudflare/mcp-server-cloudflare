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

export const DataFormatParam = z
	.enum(['timeseries', 'summary', 'timeseriesGroups'])
	.describe(
		"Specifies the data format: 'summary' for aggregated results by dimension, 'timeseries' for a time-based view of HTTP requests, or 'timeseriesGroups' to group timeseries data by dimensions."
	)

export const HttpDimensionParam = z
	.enum([
		'deviceType',
		'httpProtocol',
		'httpVersion',
		'botClass',
		'ipVersion',
		'tlsVersion',
		'os',
		'postQuantum',
	])
	.optional()
	.describe(
		"Dimension used to group HTTP data. Allowed only when the format is 'summary' or 'timeseriesGroups'."
	)
