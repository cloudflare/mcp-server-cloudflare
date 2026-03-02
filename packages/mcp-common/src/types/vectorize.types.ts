import { z } from 'zod'

import type {
	IndexCreateParams,
	IndexDimensionConfigurationParam,
	IndexInsertParams,
	IndexQueryParams,
	IndexUpsertParams,
} from 'cloudflare/resources/vectorize/indexes/indexes'

/** Zod schema for a Vectorize Index name. */
export const VectorizeIndexNameSchema: z.ZodType<IndexCreateParams['name']> = z
	.string()
	.min(1, 'Index name cannot be empty.')
	.max(64, 'Index name cannot exceed 64 characters.')
	.regex(
		/^[a-zA-Z0-9_-]+$/,
		'Index name can only contain alphanumeric characters, underscores, and hyphens.'
	)
	.describe('The name of the Vectorize Index.')

/** Zod schema for a Vectorize Index description. */
export const VectorizeIndexDescriptionSchema: z.ZodType<IndexCreateParams['description']> = z
	.string()
	.max(1024, 'Description cannot exceed 1024 characters.')
	.optional()
	.describe('An optional description for the Vectorize Index.')

/** Zod schema for Vectorize Index dimensions. */
export const VectorizeIndexDimensionSchema: z.ZodType<
	IndexDimensionConfigurationParam['dimensions']
> = z
	.number()
	.int()
	.min(32, 'Dimensions must be at least 32.')
	.max(1536, 'Dimensions must be at most 1536.')
	.positive('Dimensions must be a positive integer.')
	.describe('The number of dimensions for the vectors in the index.')

/** Zod schema for Vectorize Index distance metric. */
export const VectorizeIndexMetricSchema: z.ZodType<IndexDimensionConfigurationParam['metric']> = z
	.enum(['cosine', 'euclidean', 'dot-product'])
	.describe('The distance metric to use for similarity calculations.')

/** Zod schema for explicit dimension/metric configuration. */
export const VectorizeIndexDimensionConfigSchema: z.ZodType<IndexDimensionConfigurationParam> = z
	.object({
		dimensions: VectorizeIndexDimensionSchema,
		metric: VectorizeIndexMetricSchema,
	})
	.describe('Configuration specifying the dimensions and distance metric.')

/** Zod schema for Vectorize Index preset models. */
export const VectorizeIndexPresetSchema: z.ZodType<
	IndexCreateParams.VectorizeIndexPresetConfiguration['preset']
> = z.enum([
	'@cf/baai/bge-small-en-v1.5',
	'@cf/baai/bge-base-en-v1.5',
	'@cf/baai/bge-large-en-v1.5',
	'openai/text-embedding-ada-002',
	'cohere/embed-multilingual-v2.0',
])

/** Zod schema for preset-based configuration. */
export const VectorizeIndexPresetConfigSchema: z.ZodType<IndexCreateParams.VectorizeIndexPresetConfiguration> =
	z
		.object({
			preset: VectorizeIndexPresetSchema,
		})
		.describe('Configuration specifying a pre-defined embedding model preset.')

/** Zod schema for Vectorize Index configuration (either dimensions/metric or preset). */
export const VectorizeIndexConfigSchema: z.ZodType<IndexCreateParams['config']> = z
	.union([VectorizeIndexDimensionConfigSchema, VectorizeIndexPresetConfigSchema])
	.describe(
		'The configuration for the Vectorize Index, specifying either dimensions/metric or a preset model.'
	)

/** Zod schema for a list of vector IDs. Parameter itself is optional in tools. */
export const VectorizeVectorIdListSchema = z
	.array(z.string().min(1))
	.min(1, 'At least one vector ID must be provided.')
	.optional()
	.nullable()
	.describe('A list of vector identifiers.')

/** Zod schema for the NDJSON body used in insert/upsert operations. */
export const VectorizeNdjsonBodySchema: z.ZodType<
	IndexInsertParams['body'] | IndexUpsertParams['body']
> = z
	.string()
	.min(1, 'NDJSON body cannot be empty.')
	.describe(
		'A string containing newline-delimited JSON objects representing vectors to insert or upsert.'
	)

/** Zod schema for handling unparsable lines in NDJSON. */
export const VectorizeUnparsableBehaviorSchema: z.ZodType<
	IndexInsertParams['unparsable-behavior'] | IndexUpsertParams['unparsable-behavior']
> = z
	.enum(['error', 'discard'])
	.optional()
	.describe('Behavior for handling unparsable lines in NDJSON input.')

/** Zod schema for the query vector. */
export const VectorizeQueryVectorSchema: z.ZodType<IndexQueryParams['vector']> = z
	.array(z.number())
	.min(1, 'Query vector cannot be empty.')
	.describe('The vector used to find nearest neighbors.')

/** Zod schema for the query metadata filter. */
export const VectorizeQueryFilterSchema: z.ZodType<IndexQueryParams['filter']> = z
	.record(z.unknown())
	.optional()
	.describe('A metadata filter expression (JSON object) used to limit search results.')

/** Zod schema for controlling metadata return in queries. */
export const VectorizeQueryReturnMetadataSchema: z.ZodType<IndexQueryParams['returnMetadata']> = z
	.enum(['none', 'indexed', 'all'])
	.optional()
	.describe('Specifies whether to return no metadata, only indexed metadata, or all metadata.')

/** Zod schema for controlling value return in queries. */
export const VectorizeQueryReturnValuesSchema: z.ZodType<IndexQueryParams['returnValues']> = z
	.boolean()
	.optional()
	.describe('Specifies whether to return the vector values themselves in the results.')

/** Zod schema for the number of nearest neighbors to return in queries. */
export const VectorizeQueryTopKSchema: z.ZodType<IndexQueryParams['topK']> = z
	.number()
	.int()
	.positive('topK must be a positive integer.')
	.optional()
	.describe('The number of nearest neighbors to retrieve.')

/** Zod schema for the page number for pagination. */
export const VectorizeListPageParam = z
	.number()
	.int()
	.positive()
	.optional()
	.nullable()
	.describe('Page number for pagination.')

/** Zod schema for the number of items per page for pagination. */
export const VectorizeListPerPageParam = z
	.number()
	.int()
	.positive()
	.max(100)
	.optional()
	.nullable()
	.describe('Number of indexes to return per page (max 100).')

/** Zod schema for the order field for pagination. */
export const VectorizeListOrderParam = z
	.string()
	.optional()
	.nullable()
	.describe('Field to order results by (e.g., "name", "created_on").')

/** Zod schema for the direction for pagination. */
export const VectorizeListDirectionParam = z
	.enum(['asc', 'desc'])
	.optional()
	.nullable()
	.describe('Direction to order results (ascending or descending).')
