import z from 'zod'

export type ExecParams = z.infer<typeof ExecParams>
export const ExecParams = z.object({
	args: z.string(),
	timeout: z.number().optional().describe('Timeout in milliseconds'),
	streamStderr: z.boolean().default(true),
})

export type FilesWrite = z.infer<typeof FilesWrite>
export const FilesWrite = z.object({
	path: z.string(),
	text: z.string().describe('Full text content of the file you want to write.'),
})

export type FilePathParam = z.infer<typeof FilePathParam>
export const FilePathParam = z.string()

export type FileList = z.infer<typeof FileList>
export const FileList = z.object({
	resources: z
		.object({
			uri: z.string(),
			name: z.string(),
			description: z.string().optional(),
			mimeType: z.string().optional(),
		})
		.array(),
})

export type FilesContextSchema = z.infer<typeof FilesContextSchema>
export const FilesContextSchema = z.object({
	files: z
		.object({
			uri: z.string(),
		})
		.array(),
})
