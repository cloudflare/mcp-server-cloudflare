import { z } from 'zod'

export type WorkersService = z.infer<typeof WorkersService>
export const WorkersService = z.object({
	id: z.string(),
	default_environment: z.object({
		environment: z.string(),
		script_tag: z.string(),
		created_on: z.string(),
		modified_on: z.string(),
		script: z.object({
			created_on: z.string(),
			modified_on: z.string(),
			id: z.string(),
		}),
	}),
	created_on: z.string(),
	modified_on: z.string(),
})
