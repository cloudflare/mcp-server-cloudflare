/**
 * Account-scoped server configuration.
 *
 * Stored as a JSON file in the selected account's R2 bucket
 * (`.mcp/config.json`), so it travels with the data and requires no separate
 * server-side configuration store.
 * Managed entirely through the `get_config` / `set_config` MCP tools.
 *
 * Two things are configurable here, both by design:
 *
 *  - `reflectionsEnabled` — reflection is opt-out. Some users don't want an
 *    LLM rewriting their memory at all; they can turn it off and the
 *    `run_reflection` tool becomes a no-op.
 *  - `webhookUrl` (+ `webhookHeaders`) — a *generic* outbound webhook fired
 *    when a reflection completes. No vendor coupling: it POSTs a plain JSON
 *    payload to an automation endpoint or Worker. Vendor-specific webhook
 *    formats can be adapted there. If unset, no notification is sent.
 */

import { z } from 'zod'

import { WORKERS_AI_MODEL_ID_PATTERN } from './ai/runner'

import type { R2Storage } from './storage/r2'

export const CONFIG_PATH = '.mcp/config.json'

export interface MemoryConfig {
	/** When false, `run_reflection` is a no-op. Default: true. */
	reflectionsEnabled: boolean
	/** Optional outbound webhook URL fired on reflection completion. */
	webhookUrl?: string
	/** Optional extra headers sent with the webhook POST (e.g. auth). */
	webhookHeaders?: Record<string, string>
	/** Override the deep-analysis reflection model (Workers AI model id). */
	reflectionModel?: string
	/** Override the quick-scan reflection model (Workers AI model id). */
	reflectionModelFast?: string
}

export const DEFAULT_CONFIG: MemoryConfig = {
	reflectionsEnabled: true,
}

const ConfigSchema = z.object({
	reflectionsEnabled: z.boolean().default(true),
	webhookUrl: z
		.string()
		.max(2_048)
		.url()
		.refine((url) => ['http:', 'https:'].includes(new URL(url).protocol))
		.optional(),
	webhookHeaders: z
		.record(z.string().min(1).max(128), z.string().max(4_096))
		.refine((headers) => Object.keys(headers).length <= 20)
		.optional(),
	reflectionModel: z.string().max(256).regex(WORKERS_AI_MODEL_ID_PATTERN).optional(),
	reflectionModelFast: z.string().max(256).regex(WORKERS_AI_MODEL_ID_PATTERN).optional(),
})

export async function loadConfig(storage: R2Storage): Promise<MemoryConfig> {
	const file = await storage.read(CONFIG_PATH)
	if (!file) return { ...DEFAULT_CONFIG }
	try {
		const parsed = ConfigSchema.safeParse(JSON.parse(file.content))
		// Fail closed: malformed account config must never turn a stored
		// reflection opt-out back on.
		return parsed.success ? parsed.data : { reflectionsEnabled: false }
	} catch {
		return { reflectionsEnabled: false }
	}
}

export async function saveConfig(
	storage: R2Storage,
	patch: Partial<MemoryConfig>
): Promise<MemoryConfig> {
	const current = await loadConfig(storage)
	const parsed = ConfigSchema.safeParse({ ...current, ...patch })
	if (!parsed.success) throw new Error(`Invalid Agent Memory config: ${parsed.error.message}`)
	await storage.write(CONFIG_PATH, JSON.stringify(parsed.data, null, 2))
	return parsed.data
}
