/**
 * Generic outbound webhook.
 *
 * Fired when a reflection completes, *if* the user has configured a
 * `webhookUrl` (see `config.ts`). Deliberately vendor-neutral: it POSTs a
 * plain JSON payload with optional user-supplied headers. The user decides
 * what sits on the other end — a Slack/Discord incoming webhook, a Google
 * Chat middleware, an n8n flow, a Worker, anything that accepts a POST.
 *
 * There is no product-specific formatting (no cards, no space IDs). Callers
 * that want richer formatting can transform the payload at their endpoint.
 */

/** Describes a single change applied during reflection. */
export interface ReflectionChange {
	path: string
	action: string
	reason: string
}

export interface WebhookPayload {
	event: 'reflection.completed' | 'reflection.failed'
	date: string
	summary: string
	quickFixes?: ReflectionChange[]
	edits?: ReflectionChange[]
	failedEdits?: string[]
	error?: string
}

export interface WebhookConfig {
	url: string
	headers?: Record<string, string>
}

/**
 * POST a JSON payload to a user-configured webhook.
 *
 * Never throws — notification failures must not fail the reflection itself.
 * Returns a small result the caller can log.
 */
export async function sendWebhook(
	config: WebhookConfig,
	payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
	if (!config.url) {
		return { success: false, error: 'No webhook URL configured' }
	}

	try {
		const response = await fetch(config.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...config.headers,
			},
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return {
				success: false,
				error: `Webhook returned ${response.status}: ${errorText.slice(0, 500)}`,
			}
		}

		return { success: true }
	} catch (e) {
		return {
			success: false,
			error: `Failed to send webhook: ${e instanceof Error ? e.message : String(e)}`,
		}
	}
}
