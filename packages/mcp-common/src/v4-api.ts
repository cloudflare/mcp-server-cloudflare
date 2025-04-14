import { z } from 'zod'

type V4ErrorSchema = typeof V4ErrorSchema
const V4ErrorSchema = z.array(
	z.object({
		code: z.number().optional(),
		message: z.string(),
	})
)

export const V4Schema = <TResultType extends z.ZodType>(
	resultType: TResultType
): z.ZodObject<{
	result: z.ZodNullable<TResultType>
	success: z.ZodBoolean
	errors: V4ErrorSchema
	messages: z.ZodArray<z.ZodAny>
}> =>
	z.object({
		result: resultType.nullable(),
		success: z.boolean(),
		errors: V4ErrorSchema,
		messages: z.array(z.any()),
	})
