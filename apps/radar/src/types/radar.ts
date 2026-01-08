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
			'Use this parameter or set specific start and end dates (`dateStart` and `dateEnd` parameters). ' +
			'IMPORTANT: When using multiple dateRange values for comparison, filter array parameters (location, asn, ' +
			'continent, geoId) map positionally to each dateRange element. For example, with dateRange: ["7d", "7dcontrol"] ' +
			'and location: ["PT", "PT"], the first period uses PT and the control period also uses PT. If you only provide ' +
			'location: ["PT"], only the first period is filtered by PT while the control period defaults to worldwide data.'
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
			'Prefix a code with `-` to exclude it (e.g., ["-US", "PT"] excludes the US and includes Portugal). ' +
			'IMPORTANT: When using multiple dateRange values (e.g., ["7d", "7dcontrol"]), each array element ' +
			'maps positionally to each dateRange. To compare the same location across time periods, repeat the ' +
			'location code (e.g., location: ["PT", "PT"] with dateRange: ["7d", "7dcontrol"]). Using a single ' +
			'location with multiple dateRange values will filter only the first period, with subsequent periods ' +
			'defaulting to worldwide data.'
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
			'Prefix a code with `-` to exclude it (e.g., ["-EU", "NA"] excludes Europe and includes North America). ' +
			'IMPORTANT: When using multiple dateRange values, each array element maps positionally to each dateRange. ' +
			'To compare the same continent across time periods, repeat the continent code (e.g., continent: ["EU", "EU"] ' +
			'with dateRange: ["7d", "7dcontrol"]). Using a single continent with multiple dateRange values will filter ' +
			'only the first period, with subsequent periods defaulting to worldwide data.'
	)

export const AsnArrayParam: z.ZodType<HTTPTimeseriesParams['asn']> = z
	.array(z.string().refine((val) => val !== '0', { message: 'ASN cannot be 0' }))
	.optional()
	.describe(
		'Filters results by ASN. Provide an array of ASN strings. ' +
			'Prefix with `-` to exclude (e.g., ["-174", "3356"] excludes AS174 and includes AS3356). ' +
			'IMPORTANT: When using multiple dateRange values, each array element maps positionally to each dateRange. ' +
			'To compare the same ASN across time periods, repeat the ASN (e.g., asn: ["13335", "13335"] with ' +
			'dateRange: ["7d", "7dcontrol"]). Using a single ASN with multiple dateRange values will filter only ' +
			'the first period, with subsequent periods defaulting to all ASNs.'
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

// GeoId filter for ADM1 (administrative level 1) filtering
export const GeoIdArrayParam = z
	.array(z.string())
	.optional()
	.describe(
		'Filters results by Geolocation (ADM1 - administrative level 1, e.g., states/provinces). ' +
			'Provide an array of GeoNames IDs. Prefix with `-` to exclude. ' +
			'Example: ["2267056", "-360689"] includes Lisbon area but excludes another region. ' +
			'IMPORTANT: When using multiple dateRange values, each array element maps positionally to each dateRange. ' +
			'To compare the same region across time periods, repeat the GeoID (e.g., geoId: ["2267056", "2267056"] ' +
			'with dateRange: ["7d", "7dcontrol"]). Using a single geoId with multiple dateRange values will filter ' +
			'only the first period, with subsequent periods defaulting to all regions.'
	)

// BGP Parameters
export const BgpHijackerAsnParam = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Filter by the potential hijacker AS of a BGP hijack event.')

export const BgpVictimAsnParam = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Filter by the potential victim AS of a BGP hijack event.')

export const BgpInvolvedAsnParam = z
	.number()
	.positive()
	.optional()
	.describe('Filter by ASN involved (as hijacker or victim) in a BGP event.')

export const BgpInvolvedCountryParam = z
	.string()
	.regex(/^[a-zA-Z]{2}$/)
	.optional()
	.describe('Filter by country code of the involved AS in a BGP event.')

export const BgpLeakAsnParam = z
	.number()
	.positive()
	.optional()
	.describe('Filter by the leaking AS of a route leak event.')

export const BgpPrefixParam = z
	.string()
	.optional()
	.describe('Filter by IP prefix (e.g., "1.1.1.0/24").')

export const BgpMinConfidenceParam = z
	.number()
	.int()
	.min(1)
	.max(10)
	.optional()
	.describe('Filter by minimum confidence score (1-4 low, 5-7 mid, 8+ high).')

export const BgpMaxConfidenceParam = z
	.number()
	.int()
	.min(1)
	.max(10)
	.optional()
	.describe('Filter by maximum confidence score (1-4 low, 5-7 mid, 8+ high).')

export const BgpSortByParam = z
	.enum(['TIME', 'CONFIDENCE', 'ID'])
	.optional()
	.describe('Sort results by specified field.')

export const BgpSortOrderParam = z
	.enum(['ASC', 'DESC'])
	.optional()
	.describe('Sort order (ascending or descending).')

// Bots Parameters
export const BotsDimensionParam = z
	.enum([
		'timeseries',
		'summary/bot',
		'summary/bot_kind',
		'summary/bot_operator',
		'summary/bot_category',
		'timeseriesGroups/bot',
		'timeseriesGroups/bot_kind',
		'timeseriesGroups/bot_operator',
		'timeseriesGroups/bot_category',
	])
	.describe('Dimension indicating the type and format of bot data to retrieve.')

export const BotNameParam = z
	.array(z.string().max(100))
	.optional()
	.describe('Filter results by bot name.')

export const BotOperatorParam = z
	.array(z.string().max(100))
	.optional()
	.describe('Filter results by bot operator (e.g., Google, Microsoft, OpenAI).')

export const BotCategoryParam = z
	.array(
		z.enum([
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
	)
	.optional()
	.describe('Filter results by bot category.')

export const BotKindParam = z
	.array(z.enum(['AGENT', 'BOT']))
	.optional()
	.describe('Filter results by bot kind (AGENT or BOT).')

export const BotVerificationStatusParam = z
	.array(z.enum(['VERIFIED']))
	.optional()
	.describe('Filter results by bot verification status.')

// Certificate Transparency Parameters
export const CtDimensionParam = z
	.enum([
		'timeseries',
		'summary/ca',
		'summary/caOwner',
		'summary/duration',
		'summary/entryType',
		'summary/expirationStatus',
		'summary/hasIps',
		'summary/hasWildcards',
		'summary/logApi',
		'summary/publicKeyAlgorithm',
		'summary/signatureAlgorithm',
		'summary/validationLevel',
		'timeseriesGroups/ca',
		'timeseriesGroups/caOwner',
		'timeseriesGroups/duration',
		'timeseriesGroups/entryType',
		'timeseriesGroups/expirationStatus',
		'timeseriesGroups/hasIps',
		'timeseriesGroups/hasWildcards',
		'timeseriesGroups/logApi',
		'timeseriesGroups/publicKeyAlgorithm',
		'timeseriesGroups/signatureAlgorithm',
		'timeseriesGroups/validationLevel',
	])
	.describe(
		'Dimension indicating the type and format of Certificate Transparency data to retrieve.'
	)

export const CtCaParam = z
	.array(z.string())
	.optional()
	.describe('Filter results by certificate authority.')

export const CtCaOwnerParam = z
	.array(z.string())
	.optional()
	.describe('Filter results by certificate authority owner.')

export const CtDurationParam = z
	.array(
		z.enum([
			'LTE_3D',
			'GT_3D_LTE_7D',
			'GT_7D_LTE_10D',
			'GT_10D_LTE_47D',
			'GT_47D_LTE_100D',
			'GT_100D_LTE_200D',
			'GT_200D',
		])
	)
	.optional()
	.describe('Filter results by certificate duration.')

export const CtEntryTypeParam = z
	.array(z.enum(['PRECERTIFICATE', 'CERTIFICATE']))
	.optional()
	.describe('Filter results by entry type (certificate vs. pre-certificate).')

export const CtTldParam = z
	.array(z.string().min(2).max(63))
	.optional()
	.describe('Filter results by top-level domain (e.g., "com", "org").')

export const CtValidationLevelParam = z
	.array(z.enum(['DOMAIN', 'ORGANIZATION', 'EXTENDED']))
	.optional()
	.describe('Filter results by validation level (DV, OV, EV).')

export const CtPublicKeyAlgorithmParam = z
	.array(z.enum(['DSA', 'ECDSA', 'RSA']))
	.optional()
	.describe('Filter results by public key algorithm.')

// Netflows Parameters
export const NetflowsDimensionParam = z
	.enum(['timeseries', 'summary', 'summary/adm1', 'summary/product', 'top/locations', 'top/ases'])
	.describe('Dimension indicating the type and format of NetFlows data to retrieve.')

export const NetflowsProductParam = z
	.array(z.enum(['HTTP', 'ALL']))
	.optional()
	.describe('Filter results by network traffic product type.')

export const NormalizationParam = z
	.enum(['RAW_VALUES', 'PERCENTAGE'])
	.optional()
	.describe('Normalization method applied to results.')

export const LimitPerGroupParam = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Limits the number of items per group. Extra items appear grouped under "other".')

// Origins/Cloud Observatory Parameters (used by fetch-based tools)
export const OriginSlugParam = z
	.enum(['AMAZON', 'GOOGLE', 'MICROSOFT', 'ORACLE'])
	.describe(
		'The cloud provider origin to query. Supported values: AMAZON (AWS), GOOGLE (GCP), MICROSOFT (Azure), ORACLE (OCI).'
	)

export const OriginArrayParam = z
	.array(OriginSlugParam)
	.min(1)
	.describe('Array of cloud provider origins to query. At least one origin must be specified.')

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
		'The performance metric to retrieve. Only valid when dimension is timeseries or percentile. ' +
			'CONNECTION_FAILURES: Number of failed connections. ' +
			'REQUESTS: Total request count. ' +
			'RESPONSE_HEADER_RECEIVE_DURATION: Time to receive response headers (ms). ' +
			'TCP_HANDSHAKE_DURATION: TCP handshake time (ms). ' +
			'TCP_RTT: TCP round-trip time (ms). ' +
			'TLS_HANDSHAKE_DURATION: TLS handshake time (ms).'
	)

export const OriginDataDimensionParam = z
	.enum([
		'timeseries',
		'summary/REGION',
		'summary/SUCCESS_RATE',
		'summary/PERCENTILE',
		'timeseriesGroups/REGION',
		'timeseriesGroups/SUCCESS_RATE',
		'timeseriesGroups/PERCENTILE',
	])
	.describe(
		'Dimension indicating the type and format of origins data to retrieve. ' +
			'timeseries: Raw time series data. Requires setting the metric parameter.' +
			'summary/*: Aggregated data grouped by dimension. ' +
			'timeseriesGroups/*: Time series grouped by dimension. ' +
			'REGION: Group by cloud provider region (e.g., us-east-1). ' +
			'SUCCESS_RATE: Group by connection success rate. ' +
			'PERCENTILE: Group by performance percentiles (p50, p90, p99). Requires setting the metric parameter.'
	)

export const OriginRegionParam = z
	.array(z.string().max(100))
	.optional()
	.describe(
		'Filters results by cloud provider region. ' +
			'Example regions: us-east-1, eu-west-1, ap-southeast-1.'
	)

export const OriginNormalizationParam = z
	.enum(['PERCENTAGE', 'MIN0_MAX'])
	.optional()
	.describe('Normalization method for results.')

// ============================================================
// Robots.txt Parameters
// ============================================================

export const RobotsTxtDimensionParam = z
	.enum([
		'summary/user_agent',
		'timeseries_groups/user_agent',
		'top/domain_categories',
		'top/user_agents/directive',
	])
	.describe('Dimension indicating the type and format of robots.txt data to retrieve.')

export const RobotsTxtDirectiveParam = z
	.enum(['ALLOW', 'DISALLOW'])
	.optional()
	.describe('Filter by robots.txt directive type (ALLOW or DISALLOW).')

export const RobotsTxtPatternParam = z
	.enum(['FULLY', 'PARTIALLY'])
	.optional()
	.describe('Filter by pattern matching type (FULLY or PARTIALLY matched).')

export const RobotsTxtDomainCategoryParam = z
	.array(z.string())
	.optional()
	.describe('Filter by domain categories.')

export const RobotsTxtUserAgentCategoryParam = z
	.enum(['AI'])
	.optional()
	.describe('Filter by user agent category (currently only AI is supported).')

// ============================================================
// Bots Crawlers Parameters
// ============================================================

export const BotsCrawlersDimensionParam = z
	.enum(['CLIENT_TYPE', 'USER_AGENT', 'REFERER', 'CRAWL_REFER_RATIO', 'VERTICAL', 'INDUSTRY'])
	.describe(
		'Dimension for crawler data. CLIENT_TYPE: crawler type, USER_AGENT: crawler user agent, ' +
			'REFERER: referrer analysis, CRAWL_REFER_RATIO: crawl to referrer ratio, ' +
			'VERTICAL: industry vertical, INDUSTRY: industry classification.'
	)

export const BotsCrawlersFormatParam = z
	.enum(['summary', 'timeseries_groups'])
	.describe('Format for crawler data: summary or time series grouped data.')

export const CrawlerVerticalParam = z
	.array(z.string())
	.optional()
	.describe('Filter by industry vertical.')

export const CrawlerIndustryParam = z
	.array(z.string())
	.optional()
	.describe('Filter by industry classification.')

export const CrawlerClientTypeParam = z
	.array(z.string())
	.optional()
	.describe('Filter by client type.')

// ============================================================
// Leaked Credential Checks Parameters
// ============================================================

export const LeakedCredentialsDimensionParam = z
	.enum([
		'timeseries',
		'summary/compromised',
		'summary/bot_class',
		'timeseries_groups/compromised',
		'timeseries_groups/bot_class',
	])
	.describe('Dimension indicating the type and format of leaked credentials data to retrieve.')

export const LeakedCredentialsBotClassParam = z
	.array(z.string())
	.optional()
	.describe('Filter by bot class.')

export const LeakedCredentialsCompromisedParam = z
	.array(z.string())
	.optional()
	.describe('Filter by compromised status.')

// ============================================================
// AS112 Parameters
// ============================================================

export const As112DimensionParam = z
	.enum([
		'timeseries',
		'summary/dnssec',
		'summary/edns',
		'summary/ip_version',
		'summary/protocol',
		'summary/query_type',
		'summary/response_code',
		'timeseries_groups/dnssec',
		'timeseries_groups/edns',
		'timeseries_groups/ip_version',
		'timeseries_groups/protocol',
		'timeseries_groups/query_type',
		'timeseries_groups/response_code',
		'top/locations',
	])
	.describe(
		'Dimension indicating the type and format of AS112 data to retrieve. ' +
			'AS112 is a DNS sink hole for reverse DNS lookups of private IP addresses.'
	)

export const As112QueryTypeParam = z
	.array(z.string())
	.optional()
	.describe('Filter by DNS query type.')

export const As112ProtocolParam = z
	.array(z.string())
	.optional()
	.describe('Filter by DNS protocol (UDP/TCP).')

export const As112ResponseCodeParam = z
	.array(z.string())
	.optional()
	.describe('Filter by DNS response code.')

// ============================================================
// TCP Resets/Timeouts Parameters
// ============================================================

export const TcpResetsTimeoutsDimensionParam = z
	.enum(['summary', 'timeseries_groups'])
	.describe('Format for TCP resets/timeouts data: summary or time series grouped data.')

// ============================================================
// Annotations/Outages Parameters
// ============================================================

export const AnnotationDataSourceParam = z
	.enum([
		'ALL',
		'AI_BOTS',
		'AI_GATEWAY',
		'BGP',
		'BOTS',
		'CONNECTION_ANOMALY',
		'CT',
		'DNS',
		'DNS_MAGNITUDE',
		'DNS_AS112',
		'DOS',
		'EMAIL_ROUTING',
		'EMAIL_SECURITY',
		'FW',
		'FW_PG',
		'HTTP',
		'HTTP_CONTROL',
		'HTTP_CRAWLER_REFERER',
		'HTTP_ORIGINS',
		'IQI',
		'LEAKED_CREDENTIALS',
		'NET',
		'ROBOTS_TXT',
		'SPEED',
		'WORKERS_AI',
	])
	.optional()
	.describe('Filter annotations by data source.')

export const AnnotationEventTypeParam = z
	.enum(['EVENT', 'GENERAL', 'OUTAGE', 'PARTIAL_PROJECTION', 'PIPELINE', 'TRAFFIC_ANOMALY'])
	.optional()
	.describe('Filter annotations by event type.')

// ============================================================
// BGP Additional Parameters
// ============================================================

export const BgpUpdateTypeParam = z
	.array(z.enum(['ANNOUNCEMENT', 'WITHDRAWAL']))
	.optional()
	.describe('Filter by BGP update type (ANNOUNCEMENT or WITHDRAWAL).')

export const BgpPrefixArrayParam = z
	.array(z.string())
	.optional()
	.describe('Filter by IP prefix(es).')

export const BgpRpkiStatusParam = z
	.enum(['VALID', 'INVALID', 'UNKNOWN'])
	.optional()
	.describe('Filter by RPKI validation status.')

export const BgpLongestPrefixMatchParam = z
	.boolean()
	.optional()
	.describe('Whether to use longest prefix match.')

export const BgpOriginParam = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Filter by origin ASN.')

export const BgpInvalidOnlyParam = z
	.boolean()
	.optional()
	.describe('Only return invalid MOAS prefixes.')

// ============================================================
// Geolocation Parameters
// ============================================================

export const GeoIdParam = z
	.string()
	.describe('GeoNames ID for the geolocation (e.g., "2267056" for Lisbon).')
