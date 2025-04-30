import { z } from 'zod'

export const pageParam = z.number().int().min(1).optional().default(1)
export const perPageParam = z.number().int().min(1).max(50).optional().default(20)
