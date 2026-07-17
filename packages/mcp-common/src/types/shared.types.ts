import { z } from 'zod'

export const PaginationPerPageParam = z.number().optional()
export const PaginationPageParam = z.number().optional()

export const PaginationLimitParam = z.number().optional()
export const PaginationOffsetParam = z.number().optional()
