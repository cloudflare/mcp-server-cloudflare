import { z } from 'zod'

export const PaginationPerPageParam = z.number().nullable().optional()
export const PaginationPageParam = z.number().nullable().optional()

export const PaginationLimitParam = z.number().optional()
export const PaginationOffsetParam = z.number().optional()
