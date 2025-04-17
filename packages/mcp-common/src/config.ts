import { z } from 'zod'

export type MCPEnvironment = z.infer<typeof MCPEnvironment>
export const MCPEnvironment = z.enum(['VITEST', 'development', 'staging', 'production'])

export function getEnvironment(environment: string) {
	return MCPEnvironment.parse(environment)
}
