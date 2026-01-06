/**
 * This file contains the validators for the Cloud Observatory / Origins tools.
 * These tools provide insights into hyperscaler (cloud provider) performance metrics
 * as observed from Cloudflare's network.
 */
import { z } from 'zod'

/**
 * Supported cloud provider origins (hyperscalers)
 */
export const OriginSlugParam = z
	.enum(['AMAZON', 'GOOGLE', 'MICROSOFT', 'ORACLE'])
	.describe(
		'The cloud provider origin to query. Supported values: AMAZON (AWS), GOOGLE (GCP), MICROSOFT (Azure), ORACLE (OCI).'
	)

export const OriginArrayParam = z
	.array(OriginSlugParam)
	.min(1)
	.describe(
		'Array of cloud provider origins to query. At least one origin must be specified. ' +
			'Supported values: AMAZON (AWS), GOOGLE (GCP), MICROSOFT (Azure), ORACLE (OCI).'
	)

/**
 * Metrics available for origin performance analysis
 */
export const OriginMetricParam = z
	.enum([
		'CONNECTION_FAILURES',
		'REQUESTS',
		'RESPONSE_HEADER_RECEIVE_DURATION',
		'TCP_HANDSHAKE_DURATION',
		'TCP_RTT',
		'TLS_HANDSHAKE_DURATION',
	])
	.describe(
		'The performance metric to retrieve. ' +
			'CONNECTION_FAILURES: Number of failed connections. ' +
			'REQUESTS: Total request count. ' +
			'RESPONSE_HEADER_RECEIVE_DURATION: Time to receive response headers (ms). ' +
			'TCP_HANDSHAKE_DURATION: TCP handshake time (ms). ' +
			'TCP_RTT: TCP round-trip time (ms). ' +
			'TLS_HANDSHAKE_DURATION: TLS handshake time (ms).'
	)

/**
 * Dimensions for grouping origin metrics
 */
export const OriginDimensionParam = z
	.enum(['REGION', 'SUCCESS_RATE', 'PERCENTILE'])
	.describe(
		'The dimension by which to group results. ' +
			'REGION: Group by cloud provider region (e.g., us-east-1). ' +
			'SUCCESS_RATE: Group by connection success rate. ' +
			'PERCENTILE: Group by performance percentiles (p50, p90, p99).'
	)

/**
 * Cloud provider region filter
 */
export const OriginRegionParam = z
	.array(z.string().max(100))
	.optional()
	.describe(
		'Filters results by cloud provider region. ' +
			'Example regions: us-east-1, eu-west-1, ap-southeast-1. ' +
			'Region names vary by provider.'
	)

/**
 * Aggregation interval for time series data
 */
export const OriginAggIntervalParam = z
	.enum(['15m', '1h', '1d', '1w'])
	.optional()
	.describe(
		'Aggregation interval for time series results. ' +
			'15m: 15 minutes (for short time ranges). ' +
			'1h: 1 hour (default). ' +
			'1d: 1 day. ' +
			'1w: 1 week (for long time ranges).'
	)

/**
 * Normalization method for time series groups
 */
export const OriginNormalizationParam = z
	.enum(['PERCENTAGE', 'MIN0_MAX'])
	.optional()
	.describe(
		'Normalization method for results. ' +
			'PERCENTAGE: Values as percentages (default). ' +
			'MIN0_MAX: Normalized between 0 and max value.'
	)

/**
 * Limit per group for summary/timeseries group queries
 */
export const OriginLimitPerGroupParam = z
	.number()
	.int()
	.positive()
	.optional()
	.describe(
		'Limits the number of items per group. ' +
			'When item count exceeds the limit, extra items appear grouped under "other".'
	)
