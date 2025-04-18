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
	key: z.string(),
	operation: zQueryOperation,
	value: zPrimitiveUnion.optional(),
	type: z.enum(['string', 'number', 'boolean']),
})

export const zQueryCalculation = z.object({
	key: z.string().optional(),
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

const zViews = z
	.enum(['traces', 'events', 'calculations', 'invocations', 'requests', 'patterns'])
	.optional()

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
				data: z.array(
					zAggregateResult.merge(z.object({ firstSeen: z.string(), lastSeen: z.string() }))
				),
			})
		),
	})
)

export const zStatistics = z.object({
	elapsed: z.number(),
	rows_read: z.number(),
	bytes_read: z.number(),
})

const zCloudflareMiniEventDetailsRequest = z.object({
	url: z.string().optional(),
	method: z.string().optional(),
	path: z.string().optional(),
	search: z.record(z.string()).optional(),
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
	parameters: z.object({
		datasets: z.array(z.string()).optional(),
		filters: z.array(zQueryFilter).optional(),
		filterCombination: zFilterCombination.optional(),
		calculations: z.array(zQueryCalculation).optional(),
		groupBys: z.array(zQueryGroupBy).optional(),
		orderBy: z
			.object({
				value: z.string(),
				order: z.enum(['asc', 'desc']).optional(),
			})
			.optional(),
		limit: z.number().int().nonnegative().max(100).optional(),
		needle: zSearchNeedle.optional(),
	}),
	timeframe: z.object({
		to: z.number(),
		from: z.number(),
	}),
	granularity: z.number().optional(),
	limit: z.number().max(100).optional().default(50),
	view: zViews.optional().default('calculations'),
	dry: z.boolean().optional().default(false),
	offset: z.string().optional(),
	offsetBy: z.number().optional(),
	offsetDirection: z.string().optional(),
})

/**
 * The response from the API
 */
export type zReturnedQueryRunResult = z.infer<typeof zReturnedQueryRunResult>
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
	timeframe: z
		.object({
			to: z.number(),
			from: z.number(),
		})
		.optional(),
	datasets: z.array(z.string()).default([]),
	filters: z.array(zQueryFilter).default([]),
	limit: z.number().optional(),
	needle: zSearchNeedle.optional(),
	keyNeedle: zSearchNeedle.optional(),
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
	timeframe: z.object({
		to: z.number(),
		from: z.number(),
	}),
	key: z.string(),
	type: z.enum(['string', 'boolean', 'number']),
	datasets: z.array(z.string()),
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
