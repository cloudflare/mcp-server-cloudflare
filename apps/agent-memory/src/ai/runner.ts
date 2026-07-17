/**
 * Account-scoped Workers AI runner.
 *
 * The managed MCP servers in this repo normally use a shared `AI` Worker
 * binding, which bills the account that hosts the server. That is wrong for
 * a memory server: embeddings (indexing every write + every search) and the
 * reflection LLM are the dominant cost, and they should land on the selected
 * Cloudflare account.
 *
 * So instead of the binding, every AI call goes through the Cloudflare REST
 * API scoped to the selected account, authenticated with the OAuth access
 * token minted during authorization. The `ai:write` scope grants this.
 *
 * {@link AiRunner} is the minimal surface consumed by `embeddings.ts` and
 * the reflection LLM provider — it mirrors the `.run(model, body)` shape of
 * the Workers AI binding so the downstream code is agnostic to how the call
 * is made.
 */

export interface CloudflareCredentials {
	accountId: string
	apiToken: string
}

export interface AiRunner {
	run(model: string, body: Record<string, unknown>): Promise<unknown>
}

const API_BASE = 'https://api.cloudflare.com/client/v4'
export const WORKERS_AI_MODEL_ID_PATTERN = /^@cf\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i

/**
 * AiRunner backed by the Cloudflare REST API and scoped to one selected
 * account. Spend is billed to that account.
 */
export class RestAiRunner implements AiRunner {
	constructor(private readonly creds: CloudflareCredentials) {}

	async run(model: string, body: Record<string, unknown>): Promise<unknown> {
		if (!WORKERS_AI_MODEL_ID_PATTERN.test(model)) {
			throw new Error('Invalid Workers AI model ID')
		}
		const accountId = encodeURIComponent(this.creds.accountId)
		// Two shapes flow through here:
		//   1. Embeddings: body has `{ text }` → POST /ai/run/{model},
		//      response is wrapped in `{ result, success, errors }`.
		//   2. Chat completion (reflection): body has `{ messages, ... }` →
		//      POST /ai/v1/chat/completions (OpenAI-compatible), response is
		//      the completion object at the top level.
		const isChat = Array.isArray((body as { messages?: unknown }).messages)

		if (isChat) {
			const res = await fetch(`${API_BASE}/accounts/${accountId}/ai/v1/chat/completions`, {
				method: 'POST',
				headers: this.headers(),
				body: JSON.stringify({ model, ...body }),
			})
			if (!res.ok) {
				throw new Error(
					`Workers AI chat completion failed (${res.status}): ${(await res.text()).slice(0, 1_000)}`
				)
			}
			// OpenAI-compatible endpoint returns the completion at the top level.
			return await res.json()
		}

		const res = await fetch(`${API_BASE}/accounts/${accountId}/ai/run/${model}`, {
			method: 'POST',
			headers: this.headers(),
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			throw new Error(
				`Workers AI run failed (${res.status}): ${(await res.text()).slice(0, 1_000)}`
			)
		}
		const json = (await res.json()) as {
			result?: unknown
			success?: boolean
			errors?: Array<{ message?: string }>
		}
		if (json.success === false) {
			throw new Error(
				`Workers AI run failed: ${json.errors?.map((error) => error.message).join(', ') || 'unknown API error'}`
			)
		}
		// `/ai/run` wraps the model output in `{ result, success, errors }`.
		// Unwrap so callers see the same shape the binding returns.
		return json.result ?? json
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.creds.apiToken}`,
			'Content-Type': 'application/json',
		}
	}
}
