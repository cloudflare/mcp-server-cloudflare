import { z } from 'zod'

export const GatewayIdParam = z.string().describe('The gateway ID.')
export const LogIdParam = z.string()
export const pageParam = z.number().int().min(1).optional().default(1)
export const perPageParam = z.number().int().min(1).max(50).optional().default(20)

export const ListLogsParams = {
	gateway_id: GatewayIdParam,
	page: pageParam,
	per_page: perPageParam,
	order_by: z
		.enum([
			'created_at',
			'provider',
			'model',
			'model_type',
			'success',
			'cached',
			'cost',
			'tokens_in',
			'tokens_out',
			'duration',
			'feedback',
		])
		.optional()
		.default('created_at'),
	order_by_direction: z.enum(['asc', 'desc']).optional().default('desc'),
	start_date: z.string().datetime().optional(),
	end_date: z.string().datetime().optional(),
	feedback: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
	success: z.boolean().optional(),
	cached: z.boolean().optional(),
	model: z.string().toLowerCase().optional(),
	provider: z.string().toLowerCase().optional(),
}
