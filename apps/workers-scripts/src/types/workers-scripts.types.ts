import { z } from 'zod'

export const WorkerScript = z
	.object({
		id: z.string().optional(),
		created_on: z.string().optional(),
		modified_on: z.string().optional(),
		compatibility_date: z.string().optional(),
		compatibility_flags: z.array(z.string()).optional(),
		etag: z.string().optional(),
		bindings: z.array(z.object({ name: z.string() }).passthrough()).optional(),
	})
	.passthrough()

export const WorkerVersion = z
	.object({
		id: z.string().optional(),
		number: z.number().optional(),
		metadata: z
			.object({
				author_email: z.string().optional(),
				created_on: z.string().optional(),
				source: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough()

export const WorkerDeployment = z
	.object({
		id: z.string(),
		created_on: z.string(),
		source: z.string().optional(),
		strategy: z.literal('percentage'),
		versions: z.array(
			z.object({
				version_id: z.string(),
				percentage: z.number(),
			})
		),
		annotations: z.record(z.string(), z.string()).optional(),
	})
	.passthrough()

export type WorkerScript = z.infer<typeof WorkerScript>
export type WorkerVersion = z.infer<typeof WorkerVersion>
export type WorkerDeployment = z.infer<typeof WorkerDeployment>
