/**
 * Per-user server configuration.
 *
 * Stored as a JSON file in the user's own R2 bucket (`.mcp/config.json`), so
 * it travels with their data and requires no server-side per-user state.
 * Managed entirely through the `get_config` / `set_config` MCP tools.
 *
 * Two things are configurable here, both by design:
 *
 *  - `reflectionsEnabled` — reflection is opt-out. Some users don't want an
 *    LLM rewriting their memory at all; they can turn it off and the
 *    `run_reflection` tool becomes a no-op.
 *  - `webhookUrl` (+ `webhookHeaders`) — a *generic* outbound webhook fired
 *    when a reflection completes. No vendor coupling: it POSTs a plain JSON
 *    payload to whatever endpoint the user configures (Slack, Discord,
 *    Google Chat middleware, a Worker, n8n, …). If unset, no notification
 *    is sent.
 */

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

export async function loadConfig(storage: R2Storage): Promise<MemoryConfig> {
	const file = await storage.read(CONFIG_PATH)
	if (!file) return { ...DEFAULT_CONFIG }
	try {
		const parsed = JSON.parse(file.content) as Partial<MemoryConfig>
		return { ...DEFAULT_CONFIG, ...parsed }
	} catch {
		return { ...DEFAULT_CONFIG }
	}
}

export async function saveConfig(
	storage: R2Storage,
	patch: Partial<MemoryConfig>
): Promise<MemoryConfig> {
	const current = await loadConfig(storage)
	const next: MemoryConfig = { ...current, ...patch }
	await storage.write(CONFIG_PATH, JSON.stringify(next, null, 2))
	return next
}
