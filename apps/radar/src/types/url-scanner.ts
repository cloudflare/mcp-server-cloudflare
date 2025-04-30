/**
 * This file contains the validators for the URL scanner tools.
 */
import { z } from 'zod'

export const UrlParam = z
	.string()
	.url()
	.describe('A valid URL including protocol (e.g., "https://example.com").')

export const CreateScanResult = z
	.object({
		uuid: z.string(),
	})
	.passthrough()
