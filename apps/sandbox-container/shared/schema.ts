import z from 'zod'

export type ExecParams = z.infer<typeof ExecParams>
export const ExecParams = z.object({
	args: z.string(),
	timeout: z.number().optional().describe('Timeout in milliseconds'),
	streamStderr: z.boolean().default(true),
})

export type FileWrite = z.infer<typeof FileWrite>
export const FileWrite = z.object({
	path: z.string(),
	text: z.string().describe('Full text content of the file you want to write.'),
})

export type FilePathParam = z.infer<typeof FilePathParam>
export const FilePathParam = z.object({
	path: z.string(),
})
