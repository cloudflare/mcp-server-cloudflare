import { z } from 'zod'

export const CloudflareUserSchema = z.object({
	id: z.string(),
	email: z.string(),
})

export const CloudflareAccountSchema = z.object({
	name: z.string(),
	id: z.string(),
})

export const CloudflareAccountsSchema = z.array(CloudflareAccountSchema)

const AccountTokenAuthPropsSchema = z.object({
	type: z.literal('account_token'),
	accessToken: z.string(),
	account: CloudflareAccountSchema,
})

const UserTokenAuthPropsSchema = z.object({
	type: z.literal('user_token'),
	accessToken: z.string(),
	user: CloudflareUserSchema,
	accounts: CloudflareAccountsSchema,
	refreshToken: z.string().optional(),
})

export const AuthPropsSchema = z.discriminatedUnion('type', [
	AccountTokenAuthPropsSchema,
	UserTokenAuthPropsSchema,
])

export type AuthProps = z.infer<typeof AuthPropsSchema>
export type CloudflareUser = z.infer<typeof CloudflareUserSchema>
export type CloudflareAccounts = z.infer<typeof CloudflareAccountsSchema>
