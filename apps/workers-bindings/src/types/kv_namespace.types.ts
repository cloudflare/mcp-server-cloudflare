import { z } from 'zod'

import type {
	Namespace,
	NamespaceCreateParams,
	NamespaceDeleteParams,
	NamespaceGetParams,
	NamespaceListParams,
	NamespaceUpdateParams,
} from 'cloudflare/resources/kv.mjs'

/**
 * Zod schema for a KV namespace ID.
 */
export const KvNamespaceIdSchema: z.ZodType<Namespace['id']> = z
	.string()
	.describe('The ID of the KV namespace')

/**
 * Zod schema for a KV namespace title.
 */
export const KvNamespaceTitleSchema: z.ZodType<Namespace['title']> = z
	.string()
	.describe('The human-readable name/title of the KV namespace')

/**
 * Zod schema for the optional parameters when listing KV namespaces.
 */
export const KvNamespacesListParamsSchema: z.ZodType<Omit<NamespaceListParams, 'account_id'>> = z
	.object({
		direction: z
			.enum(['asc', 'desc'])
			.optional()
			.describe('Direction to order namespaces (asc/desc)'),
		order: z.enum(['id', 'title']).optional().describe('Field to order namespaces by (id/title)'),
		page: z.number().int().positive().optional().describe('Page number of results (starts at 1)'),
		per_page: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.describe('Number of namespaces per page (1-100)'),
	})
	.describe('Optional parameters for listing KV namespaces')

/**
 * Zod schema for parameters needed to create a KV namespace.
 */
export const KvNamespaceCreateParamsSchema: z.ZodType<Omit<NamespaceCreateParams, 'account_id'>> = z
	.object({
		title: KvNamespaceTitleSchema,
	})
	.describe('Parameters for creating a KV namespace')

/**
 * Zod schema for parameters needed to delete a KV namespace.
 */
export const KvNamespaceDeleteParamsSchema: z.ZodType<Omit<NamespaceDeleteParams, 'account_id'>> = z
	.object({
		namespace_id: KvNamespaceIdSchema,
	})
	.describe('Parameters for deleting a KV namespace')

/**
 * Zod schema for parameters needed to get a KV namespace.
 */
export const KvNamespaceGetParamsSchema: z.ZodType<Omit<NamespaceGetParams, 'account_id'>> = z
	.object({
		namespace_id: KvNamespaceIdSchema,
	})
	.describe('Parameters for getting a KV namespace')

/**
 * Zod schema for parameters needed to update a KV namespace.
 */
export const KvNamespaceUpdateParamsSchema: z.ZodType<Omit<NamespaceUpdateParams, 'account_id'>> = z
	.object({
		namespace_id: KvNamespaceIdSchema,
		title: KvNamespaceTitleSchema,
	})
	.describe('Parameters for updating a KV namespace')
