import { z } from 'zod'

type V4ErrorSchema = typeof V4ErrorSchema
const V4ErrorSchema = z.array(
	z.object({
		code: z.number().optional(),
		message: z.string(),
	})
)

export type V4Schema<TResultType extends z.ZodType> = z.ZodObject<{
	result: z.ZodNullable<TResultType>
	success: z.ZodBoolean
	errors: V4ErrorSchema
	messages: z.ZodArray<z.ZodAny>
}>

export type V4SchemaWithResultInfo<
	TResultType extends z.ZodType,
	TResultInfoType extends z.ZodType,
> = z.ZodObject<{
	result: z.ZodNullable<TResultType>
	success: z.ZodBoolean
	errors: V4ErrorSchema
	messages: z.ZodArray<z.ZodAny>
	result_info: z.ZodOptional<z.ZodNullable<TResultInfoType>>
}>

export function V4Schema<TResultType extends z.ZodType>(
	resultType: TResultType
): V4Schema<TResultType>
export function V4Schema<TResultType extends z.ZodType, TResultInfoType extends z.ZodType>(
	resultType: TResultType,
	resultInfoType: TResultInfoType
): V4SchemaWithResultInfo<TResultType, TResultInfoType>
export function V4Schema<TResultType extends z.ZodType, TResultInfoType extends z.ZodType>(
	resultType: TResultType,
	resultInfoType?: TResultInfoType
): V4Schema<TResultType> | V4SchemaWithResultInfo<TResultType, TResultInfoType> {
	if (resultInfoType) {
		return z.object({
			result: resultType.nullable(),
			result_info: resultInfoType.nullable().optional(),
			success: z.boolean(),
			errors: V4ErrorSchema,
			messages: z.array(z.any()),
		})
	} else {
		return z.object({
			result: resultType.nullable(),
			success: z.boolean(),
			errors: V4ErrorSchema,
			messages: z.array(z.any()),
		})
	}
}
