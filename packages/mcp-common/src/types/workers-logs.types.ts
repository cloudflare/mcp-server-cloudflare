import { z } from 'zod'

export const numericalOperations = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const

export const queryOperations = [
	// applies only to strings
	'includes',
	'not_includes',

	// string operations
	'starts_with',
	'regex',

	// existence check
	'exists',
	'is_null',

	// right hand side must be a string with comma separated values
	'in',
	'not_in',

	// numerica
	...numericalOperations,
] as const

export const queryOperators = [
	'uniq',
	'count',
	'max',
	'min',
	'sum',
	'avg',
	'median',
	'p001',
	'p01',
	'p05',
	'p10',
	'p25',
	'p75',
	'p90',
	'p95',
	'p99',
	'p999',
	'stddev',
	'variance',
] as const

export const zQueryOperator = z.enum(queryOperators)
export const zQueryOperation = z.enum(queryOperations)
export const zQueryNumericalOperations = z.enum(numericalOperations)

export const zOffsetDirection = z.enum(['next', 'prev'])
export const zFilterCombination = z.enum(['and', 'or', 'AND', 'OR'])

export const zPrimitiveUnion = z.union([z.string(), z.number(), z.boolean()])

export const zQueryFilter = z.object({
	key: z.string().describe(`Filter field name. IMPORTANT:

    • DO NOT guess keys - always use verified keys from either:
      - Previous query results
      - The observability_keys response

    • PREFERRED KEYS (faster & always available):
      - $metadata.service: Worker service name
			- $metadata.origin: Trigger type (e.g., fetch, scheduled, etc.)
			- $metadata.trigger: Trigger type (e.g., GET /users, POST /orders, etc.)
      - $metadata.message: Log message text (present in nearly all logs)
      - $metadata.error: Error message (when applicable)
`),
	operation: zQueryOperation,
	value: zPrimitiveUnion.optional().describe(`Filter comparison value. IMPORTANT:

    • MUST match actual values in your logs
    • VERIFY using either:
      - Actual values from previous query results
      - The '/values' endpoint with your selected key

    • TYPE MATCHING:
      - Ensure value type (string/number/boolean) matches the field type
      - String comparisons are case-sensitive unless using specific operations

    • PATTERN USAGE:
      - For 'contains', use simple wildcard patterns
      - For 'regex', MUST use ClickHouse regex syntax:
        - Uses RE2 syntax (not PCRE/JavaScript)
        - No lookaheads/lookbehinds
        - Examples: '^5\\d{2}$' for HTTP 5xx codes, '\\bERROR\\b' for word boundary
        - Escape backslashes with double backslash`),
	type: z.enum(['string', 'number', 'boolean']),
}).describe(`
	## Filtering Best Practices
- Before applying filters, use the observability_keys and observability_values queries to confirm available filter fields and values.
- If the query is asking to find something you should check that it exists. I.e. to requests with errors filter for $metadata.error exists.
	`)

export const zQueryCalculation = z.object({
	key: z.string().optional()
		.describe(`The key to use for the calculation. This key must exist in the logs.
Use the Keys endpoint to confirm that this key exists

• DO NOT guess keys - always use verified keys from either:
- Previous query results
- The observability_keys response`),
	keyType: z.enum(['string', 'number', 'boolean']).optional(),
	operator: zQueryOperator,
	alias: z.string().optional(),
})
export const zQueryGroupBy = z.object({
	type: z.enum(['string', 'number', 'boolean']),
	value: z.string(),
})

export const zSearchNeedle = z.object({
	value: zPrimitiveUnion,
	isRegex: z.boolean().optional(),
	matchCase: z.boolean().optional(),
})

const zViews = z.enum(['events', 'calculations', 'invocations'])

export const zAggregateResult = z.object({
	groups: z.array(z.object({ key: z.string(), value: zPrimitiveUnion })).optional(),
	value: z.number(),
	count: z.number(),
	interval: z.number(),
	sampleInterval: z.number(),
})

export const zQueryRunCalculationsV2 = z.array(
	z.object({
		alias: z
			.string()
			.transform((val) => (val === '' ? undefined : val))
			.optional(),
		calculation: z.string(),
		aggregates: z.array(zAggregateResult),
		series: z.array(
			z.object({
				time: z.string(),
				data: z.array(zAggregateResult),
			})
		),
	})
)

export const zStatistics = z.object({
	elapsed: z.number(),
	rows_read: z.number(),
	bytes_read: z.number(),
})

export const zTimeframe = z
	.object({
		to: z.string(),
		from: z.string(),
	})
	.describe(
		`Timeframe for your query (ISO-8601 format).

  • Current server time: ${new Date()}
  • Default: Last hour from current time
  • Maximum range: Last 7 days
  • Format: "YYYY-MM-DDTHH:MM:SSZ" (e.g., "2025-04-29T14:30:00Z")

  Examples:
  - Last 30 minutes: from="2025-04-29T14:00:00Z", to="2025-04-29T14:30:00Z"
  - Yesterday: from="2025-04-28T00:00:00Z", to="2025-04-29T00:00:00Z"

  Note: Narrower timeframes provide faster responses and more specific results.
  Omit this parameter entirely to use the default (last hour).`
	)

const zCloudflareMiniEventDetailsRequest = z.object({
	url: z.string().optional(),
	method: z.string().optional(),
	path: z.string().optional(),
	search: z.record(z.any()).optional(),
})

const zCloudflareMiniEventDetailsResponse = z.object({
	status: z.number().optional(),
})

const zCloudflareMiniEventDetails = z.object({
	request: zCloudflareMiniEventDetailsRequest.optional(),
	response: zCloudflareMiniEventDetailsResponse.optional(),
	rpcMethod: z.string().optional(),
	rayId: z.string().optional(),
	executionModel: z.string().optional(),
})

export const zCloudflareMiniEvent = z.object({
	event: zCloudflareMiniEventDetails,
	scriptName: z.string(),
	outcome: z.string(),
	eventType: z.enum([
		'fetch',
		'scheduled',
		'alarm',
		'cron',
		'queue',
		'email',
		'tail',
		'rpc',
		'websocket',
		'unknown',
	]),
	entrypoint: z.string().optional(),
	scriptVersion: z
		.object({
			id: z.string().optional(),
			tag: z.string().optional(),
			message: z.string().optional(),
		})
		.optional(),
	truncated: z.boolean().optional(),
	executionModel: z.enum(['durableObject', 'stateless']).optional(),
	requestId: z.string(),
	cpuTimeMs: z.number().optional(),
	wallTimeMs: z.number().optional(),
})

export const zCloudflareEvent = zCloudflareMiniEvent.extend({
	diagnosticsChannelEvents: z
		.array(
			z.object({
				timestamp: z.number(),
				channel: z.string(),
				message: z.string(),
			})
		)
		.optional(),
	dispatchNamespace: z.string().optional(),
	wallTimeMs: z.number(),
	cpuTimeMs: z.number(),
})

const zSourceSchema = z.object({
	exception: z
		.object({
			stack: z.string().optional(),
			name: z.string().optional(),
			message: z.string().optional(),
			timestamp: z.number().optional(),
		})
		.optional(),
})

export const zReturnedTelemetryEvent = z.object({
	dataset: z.string(),
	timestamp: z.number().int().positive(),
	source: z.union([z.string(), zSourceSchema]),
	$workers: z.union([zCloudflareMiniEvent, zCloudflareEvent]).optional(),
	$metadata: z.object({
		id: z.string(),
		requestId: z.string().optional(),
		traceId: z.string().optional(),
		spanId: z.string().optional(),
		trigger: z.string().optional(),
		parentSpanId: z.string().optional(),
		service: z.string().optional(),
		level: z.string().optional(),
		duration: z.number().positive().int().optional(),
		statusCode: z.number().positive().int().optional(),
		traceDuration: z.number().positive().int().optional(),
		error: z.string().optional(),
		message: z.string().optional(),
		spanName: z.string().optional(),
		url: z.string().optional(),
		region: z.string().optional(),
		account: z.string().optional(),
		provider: z.string().optional(),
		type: z.string().optional(),
		fingerprint: z.string().optional(),
		origin: z.string().optional(),
		metricName: z.string().optional(),
		stackId: z.string().optional(),
		coldStart: z.number().positive().int().optional(),
		cost: z.number().positive().int().optional(),
		cloudService: z.string().optional(),
		messageTemplate: z.string().optional(),
		errorTemplate: z.string().optional(),
	}),
})

export type zReturnedQueryRunEvents = z.infer<typeof zReturnedQueryRunEvents>
export const zReturnedQueryRunEvents = z.object({
	events: z.array(zReturnedTelemetryEvent).optional(),
	fields: z
		.array(
			z.object({
				key: z.string(),
				type: z.string(),
			})
		)
		.optional(),
	count: z.number().optional(),
})

/**
 * The request to run a query
 */
export const zQueryRunRequest = z.object({
	// TODO: Fix these types
	queryId: z.string(),
	view: zViews.optional().default('calculations').describe(`## Examples by View Type
		### Events View
		- "Show me all errors for the worker api-proxy in the last 30 minutes"
		- "Show events from worker auth-service where the path contains /login"

		### Calculation View
		- "What is the p99 of wall time for worker api-proxy?"
		- "What's the count of requests by status code for worker cdn-router?"

		### Invocation View
		- "Find a request to worker api-proxy that resulted in a 500 error"
		- "List successful requests for the image-resizer worker with status code 200"
				`),
	parameters: z.object({
		datasets: z
			.array(z.string())
			.optional()
			.describe('Leave this empty to use the default datasets'),
		filters: z.array(zQueryFilter).optional(),
		filterCombination: zFilterCombination.optional(),
		calculations: z.array(zQueryCalculation).optional(),
		groupBys: z.array(zQueryGroupBy).optional().describe(`Only valid when doing a Calculation`),
		orderBy: z
			.object({
				value: z.string().describe('This must be the alias of a calculation'),
				order: z.enum(['asc', 'desc']).optional(),
			})
			.optional()
			.describe('Order By only workers when a group by is present'),
		limit: z
			.number()
			.int()
			.nonnegative()
			.max(100)
			.optional()
			.describe(
				'Use this limit when view is calculation and a group by is present. 10 is a sensible default'
			),
		needle: zSearchNeedle.optional(),
	}),
	timeframe: zTimeframe,
	granularity: z
		.number()
		.optional()
		.describe(
			'This is only used when the view is calculations - by leaving it empty workers observability will detect the correct granularity'
		),
	limit: z
		.number()
		.max(100)
		.optional()
		.default(5)
		.describe(
			'Use this limit to limit the number of events returned when the view is events. 5 is a sensible default'
		),

	dry: z.boolean().optional().default(true),
	offset: z
		.string()
		.optional()
		.describe(
			'The offset to use for pagination. Use the $metadata.id field to get the next offset.'
		),
	offsetBy: z.number().optional(),
	offsetDirection: z
		.string()
		.optional()
		.describe('The direction to use for pagination. Use "next" or "prev".'),
})

/**
 * The response from the API
 */
export type ReturnedQueryRunResult = z.infer<typeof zReturnedQueryRunResult>
export const zReturnedQueryRunResult = z.object({
	// run: zQueryRunRequest,
	calculations: zQueryRunCalculationsV2.optional(),
	compare: zQueryRunCalculationsV2.optional(),
	events: zReturnedQueryRunEvents.optional(),
	invocations: z.record(z.string(), z.array(zReturnedTelemetryEvent)).optional(),
	statistics: zStatistics,
})

/**
 * Keys Request
 */
export const zKeysRequest = z.object({
	timeframe: zTimeframe,
	datasets: z
		.array(z.string())
		.default([])
		.describe('Leave this empty to use the default datasets'),
	filters: z.array(zQueryFilter).default([]),
	limit: z.number().optional().describe(`
    • ADVANCED USAGE:
      set limit=1000+ to retrieve comprehensive key options without needing additional filtering`),
	needle: zSearchNeedle.optional(),
	keyNeedle: zSearchNeedle.optional()
		.describe(`If the user makes a suggestion for a key, use this to narrow down the list of keys returned.
		Make sure match case is fals to avoid case sensitivity issues.`),
})

/**
 * Keys Response
 */
export type zKeysResponse = z.infer<typeof zKeysResponse>
export const zKeysResponse = z.array(
	z.object({
		key: z.string(),
		type: z.enum(['string', 'boolean', 'number']),
		lastSeenAt: z.number(),
	})
)

/**
 * Values Request
 */
export const zValuesRequest = z.object({
	timeframe: zTimeframe,
	key: z.string(),
	type: z.enum(['string', 'boolean', 'number']),
	datasets: z
		.array(z.string())
		.default([])
		.describe('Leave this empty to use the default datasets'),
	filters: z.array(zQueryFilter).default([]),
	limit: z.number().default(50),
	needle: zSearchNeedle.optional(),
})

/** Values Response */
export const zValuesResponse = z.array(
	z.object({
		key: z.string(),
		type: z.enum(['string', 'boolean', 'number']),
		value: z.union([z.string(), z.number(), z.boolean()]),
		dataset: z.string(),
	})
)
