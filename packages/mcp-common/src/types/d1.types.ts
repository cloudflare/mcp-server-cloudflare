/**
 * This file contains the validators for the d1 tools.
 */
import { z } from 'zod'

import type { DatabaseCreateParams } from 'cloudflare/resources/d1.mjs'

export const D1DatabaseNameParam: z.ZodType<DatabaseCreateParams['name']> = z.string()
export const D1DatabasePrimaryLocationHintParam: z.ZodType<
	DatabaseCreateParams['primary_location_hint']
> = z.enum(['wnam', 'enam', 'weur', 'eeur', 'apac', 'oc']).optional()

export const D1DatabaseQuerySqlParam = z.string()
export const D1DatabaseQueryParamsParam = z.array(z.string()).optional()
