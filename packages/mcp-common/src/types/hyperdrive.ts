import { z } from 'zod'

import type { ConfigCreateParams } from 'cloudflare/resources/hyperdrive/configs.mjs'

// --- Base Field Schemas ---

/** Zod schema for a Hyperdrive config ID. */
export const HyperdriveConfigIdSchema = z
	.string()
	.describe('The ID of the Hyperdrive configuration')

/** Zod schema for a Hyperdrive config name. */
export const HyperdriveConfigNameSchema: z.ZodType<ConfigCreateParams['name']> = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/)
	.describe('The name of the Hyperdrive configuration (alphanumeric, underscore, hyphen)')

// --- Origin Field Schemas ---

/** Zod schema for the origin database name. */
export const HyperdriveOriginDatabaseSchema: z.ZodType<
	ConfigCreateParams.PublicDatabase['database']
> = z.string().describe('The database name')
/** Zod schema for the origin database host. */
export const HyperdriveOriginHostSchema: z.ZodType<ConfigCreateParams.PublicDatabase['host']> = z
	.string()
	.describe('The database host address')
/** Zod schema for the origin database port. */
export const HyperdriveOriginPortSchema: z.ZodType<ConfigCreateParams.PublicDatabase['port']> = z
	.number()
	.int()
	.min(1)
	.max(65535)
	.describe('The database port')
/** Zod schema for the origin database scheme. */
export const HyperdriveOriginSchemeSchema: z.ZodType<ConfigCreateParams.PublicDatabase['scheme']> =
	z.enum(['postgresql']).describe('The database protocol')
/** Zod schema for the origin database user. */
export const HyperdriveOriginUserSchema: z.ZodType<ConfigCreateParams.PublicDatabase['user']> = z
	.string()
	.describe('The database user')
/** Zod schema for the origin database password. */
export const HyperdriveOriginPasswordSchema: z.ZodType<
	ConfigCreateParams.PublicDatabase['password']
> = z.string().describe('The database password')

// --- Caching Field Schemas (Referencing ConfigCreateParams.HyperdriveHyperdriveCachingEnabled) ---

/** Zod schema for disabling caching. */
export const HyperdriveCachingDisabledSchema: z.ZodType<
	ConfigCreateParams.HyperdriveHyperdriveCachingEnabled['disabled']
> = z.boolean().optional().describe('Whether caching is disabled')
/** Zod schema for the maximum cache age. */
export const HyperdriveCachingMaxAgeSchema: z.ZodType<
	ConfigCreateParams.HyperdriveHyperdriveCachingEnabled['max_age']
> = z.number().int().min(1).optional().describe('Maximum cache age in seconds')
/** Zod schema for the stale while revalidate duration. */
export const HyperdriveCachingStaleWhileRevalidateSchema: z.ZodType<
	ConfigCreateParams.HyperdriveHyperdriveCachingEnabled['stale_while_revalidate']
> = z.number().int().min(1).optional().describe('Stale while revalidate duration in seconds')

// --- List Parameter Schemas (Cannot directly type against SDK ConfigListParams which only has account_id) ---

/** Zod schema for the list page number. */
export const HyperdriveListParamPageSchema = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Page number of results')
/** Zod schema for the list results per page. */
export const HyperdriveListParamPerPageSchema = z
	.number()
	.int()
	.min(1)
	.max(100)
	.optional()
	.describe('Number of results per page')
/** Zod schema for the list order field. */
export const HyperdriveListParamOrderSchema = z
	.enum(['id', 'name'])
	.optional()
	.describe('Field to order by')
/** Zod schema for the list order direction. */
export const HyperdriveListParamDirectionSchema = z
	.enum(['asc', 'desc'])
	.optional()
	.describe('Direction to order')

// --- Tool Parameter Schemas ---
