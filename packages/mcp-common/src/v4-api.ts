import { z } from 'zod'

type V4ErrorSchema = typeof V4ErrorSchema
const V4ErrorSchema = z.array(
	z.object({
		code: z.number().optional(),
		message: z.string(),
	})
)

const V4ResultInfoSchema = z.object({
	next: z.string().nullable(),
	previous: z.string().nullable(),
	per_page: z.number().nullable(),
	count: z.number().nullable(),
	total_count: z.number().nullable(),
})

export type zV4ResultInfoSchema = z.infer<typeof V4ResultInfoSchema>

export const V4Schema = <TResultType extends z.ZodType>(
	resultType: TResultType
): z.ZodObject<{
	result: z.ZodNullable<TResultType>
	success: z.ZodBoolean
	errors: V4ErrorSchema
	messages: z.ZodArray<z.ZodAny>
}> =>
	z.object({
		result_info: V4ResultInfoSchema.nullable(),
		result: resultType.nullable(),
		success: z.boolean(),
		errors: V4ErrorSchema,
		messages: z.array(z.any()),
	})
