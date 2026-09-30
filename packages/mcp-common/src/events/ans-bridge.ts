import { z } from 'zod'

export const MAX_EVENT_BYTES = 256 * 1024
export const SUPPORTED_ALERT_TYPES: ReadonlySet<string> = new Set([
	'workers_observability_real_time_issue',
])

const CallbackUrl = z
	.string()
	.url()
	.refine((value) => {
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password && !url.hash
	}, 'Callback must be an HTTPS URL without credentials or a fragment')

export const AlertArguments = z
	.object({
		account_id: z.string().regex(/^[a-f0-9]{32}$/),
		filters: z.record(z.string(), z.array(z.string())).default({}),
	})
	.strict()

export const SubscribeParams = z
	.object({
		name: z
			.string()
			.regex(/^cloudflare\.alert\.[a-z][a-z0-9_]*$/)
			.refine(
				(name) => SUPPORTED_ALERT_TYPES.has(name.slice('cloudflare.alert.'.length)),
				'Event is not in the supported MCP catalogue'
			),
		arguments: AlertArguments,
		delivery: z
			.object({
				mode: z.literal('webhook'),
				url: CallbackUrl,
				secret: z.string().refine((value) => {
					try {
						const key = decodeSecret(value)
						return key.length >= 24 && key.length <= 64
					} catch {
						return false
					}
				}, 'Expected whsec_ with a base64-encoded 24–64 byte key'),
			})
			.strict(),
		cursor: z.null().optional(),
		ttlMs: z.number().int().positive().nullable().optional(),
	})
	.strict()

export const UnsubscribeParams = SubscribeParams.omit({ ttlMs: true }).extend({
	delivery: SubscribeParams.shape.delivery.omit({ secret: true }),
})

export const AvailableAlert = z.object({
	type: z.string().regex(/^[a-z][a-z0-9_]*$/),
	display_name: z.string(),
	description: z.string(),
	filter_options: z
		.array(
			z.object({
				Key: z.string().min(1),
				Range: z.string().optional(),
				ComparisonOperator: z.string().optional(),
				AvailableValues: z
					.array(z.object({ ID: z.string(), Description: z.string() }))
					.nullable()
					.optional(),
			})
		)
		.nullish()
		.transform((options) => options ?? []),
})

export const AlertPayload = z.object({
	name: z.string(),
	text: z.string(),
	account_id: z.string(),
	account_name: z.string().optional(),
	policy_id: z.string(),
	policy_name: z.string().optional(),
	alert_type: z.string(),
	alert_correlation_id: z.string().optional(),
	alert_event: z.string().optional(),
	event_id: z.string().optional(),
	severity: z.string().optional(),
	ts: z.number().int().nonnegative(),
	data: z.record(z.string(), z.unknown()).optional(),
})

export type NotificationPayload = z.infer<typeof AlertPayload>

const IssueNotificationPayload = AlertPayload.extend({
	data: z
		.object({
			issue: z
				.object({
					id: z.string().min(1),
					services: z.array(z.object({ name: z.string().min(1) }).passthrough()).min(1),
				})
				.passthrough(),
		})
		.passthrough(),
})

const EventPayloadSchemas: Readonly<Record<string, z.ZodType<NotificationPayload>>> = {
	workers_observability_real_time_issue: IssueNotificationPayload,
}

export function alertEventDefinitions(catalog: unknown) {
	const groups = z.record(z.string(), z.array(AvailableAlert)).parse(catalog)
	return Object.values(groups)
		.flat()
		.filter((alert) => SUPPORTED_ALERT_TYPES.has(alert.type))
		.map((alert) => ({
			name: `cloudflare.alert.${alert.type}`,
			description: `${alert.display_name}: ${alert.description}`,
			delivery: ['webhook'],
			inputSchema: {
				type: 'object',
				properties: {
					account_id: { type: 'string', pattern: '^[a-f0-9]{32}$' },
					filters: {
						type: 'object',
						properties: Object.fromEntries(
							alert.filter_options.map((option) => [
								option.Key,
								{
									type: 'array',
									items: {
										type: 'string',
										...(option.AvailableValues?.length
											? { enum: option.AvailableValues.map((value) => value.ID) }
											: {}),
									},
									...(option.Range?.startsWith('1-') ? { minItems: 1 } : {}),
								},
							])
						),
						required: alert.filter_options
							.filter((option) => option.Range?.startsWith('1-'))
							.map((option) => option.Key),
						additionalProperties: false,
					},
				},
				required: [
					'account_id',
					...(alert.filter_options.some((option) => option.Range?.startsWith('1-'))
						? ['filters']
						: []),
				],
				additionalProperties: false,
			},
			payloadSchema: z.toJSONSchema(EventPayloadSchemas[alert.type]),
		}))
}

export interface Subscription {
	id: string
	principal: string
	accountId: string
	policyId: string
	alertType: string
	callbackUrl: string
	signingSecret: string
	previousSigningSecret?: string
	previousSecretExpiresAt?: number
	ingressSecret: string
	expiresAt: number
	active: boolean
}

export interface BridgeDependencies {
	loadSubscription(id: string): Promise<Subscription | null>
	hasAccess(subscription: Subscription): Promise<boolean>
	deactivateSubscription(id: string): Promise<void>
	eventIdentity(subscription: Subscription, alert: NotificationPayload): Promise<string>
	webhookFetch: typeof fetch
	now(): number
}

function decodeSecret(secret: string): Uint8Array {
	if (!secret.startsWith('whsec_')) throw new Error('Invalid signing key prefix')
	const encoded = secret.slice(6)
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid base64 signing key')
	const decoded = atob(encoded)
	if (btoa(decoded).replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
		throw new Error('Noncanonical base64 signing key')
	}
	return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

async function digest(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
	if (value !== null && typeof value === 'object') {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(',')}}`
	}
	return JSON.stringify(value)
}

export async function subscriptionId(principal: string, input: unknown): Promise<string> {
	const subscription = SubscribeParams.safeParse(input)
	const params = subscription.success ? subscription.data : UnsubscribeParams.parse(input)
	return `sub_${await digest(
		canonicalJson([principal, params.delivery.url, params.name, params.arguments])
	)}`
}

export function subscriptionExpiration(now: number, ttlMs?: number | null): number {
	if (ttlMs !== undefined && ttlMs !== null && (!Number.isSafeInteger(ttlMs) || ttlMs <= 0)) {
		throw new Error('Invalid subscription lifetime')
	}
	return now + Math.min(ttlMs ?? 24 * 60 * 60 * 1000, 24 * 60 * 60 * 1000)
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
	const leftHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(left))
	const rightHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(right))
	const leftBytes = new Uint8Array(leftHash)
	const rightBytes = new Uint8Array(rightHash)
	let difference = 0
	for (let index = 0; index < leftBytes.length; index++) {
		difference |= leftBytes[index] ^ rightBytes[index]
	}
	return difference === 0
}

export async function signedHeaders(
	subscription: Subscription,
	eventId: string,
	body: string,
	now: number
): Promise<Headers> {
	const timestamp = String(Math.floor(now / 1000))
	const secrets = [subscription.signingSecret]
	if (subscription.previousSigningSecret && (subscription.previousSecretExpiresAt ?? 0) > now) {
		secrets.push(subscription.previousSigningSecret)
	}
	const signatures = await Promise.all(
		secrets.map(async (secret) => {
			const bytes = decodeSecret(secret)
			if (bytes.length < 24 || bytes.length > 64) throw new Error('Invalid signing key length')
			const key = await crypto.subtle.importKey(
				'raw',
				bytes.buffer as ArrayBuffer,
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			)
			const signature = await crypto.subtle.sign(
				'HMAC',
				key,
				new TextEncoder().encode(`${eventId}.${timestamp}.${body}`)
			)
			return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`
		})
	)
	return new Headers({
		'Content-Type': 'application/json',
		'webhook-id': eventId,
		'webhook-timestamp': timestamp,
		'webhook-signature': signatures.join(' '),
		'X-MCP-Subscription-Id': subscription.id,
	})
}

export async function verifyCallback(
	subscription: Subscription,
	webhookFetch: typeof fetch,
	now: number
): Promise<void> {
	CallbackUrl.parse(subscription.callbackUrl)
	const challenge = crypto.randomUUID()
	const body = JSON.stringify({ type: 'verification', challenge })
	const response = await webhookFetch(subscription.callbackUrl, {
		method: 'POST',
		redirect: 'error',
		signal: AbortSignal.timeout(10_000),
		headers: await signedHeaders(
			subscription,
			`msg_verification_${crypto.randomUUID()}`,
			body,
			now
		),
		body,
	})
	if (!response.ok) throw new Error('Callback verification failed')
	const result = z.object({ challenge: z.string() }).parse(await response.json())
	if (!(await constantTimeEqual(challenge, result.challenge))) {
		throw new Error('Callback verification failed')
	}
}

export async function forwardAnsWebhook(
	request: Request,
	id: string,
	dependencies: BridgeDependencies
): Promise<Response> {
	if (request.method !== 'POST') return new Response(null, { status: 405 })
	const subscription = await dependencies.loadSubscription(id)
	if (
		!subscription ||
		!(await constantTimeEqual(
			request.headers.get('cf-webhook-auth') ?? '',
			subscription.ingressSecret
		)) ||
		!subscription.ingressSecret
	) {
		return new Response(null, { status: 401 })
	}
	const now = dependencies.now()
	if (!subscription.active || subscription.expiresAt <= now) {
		return new Response(null, { status: 204 })
	}
	if (!(await dependencies.hasAccess(subscription))) {
		await dependencies.deactivateSubscription(id)
		return new Response(null, { status: 204 })
	}
	const reader = request.body?.getReader()
	if (!reader) return new Response(null, { status: 400 })
	const chunks: Uint8Array[] = []
	let size = 0
	while (true) {
		const chunk = await reader.read()
		if (chunk.done) break
		size += chunk.value.length
		if (size > MAX_EVENT_BYTES) {
			await reader.cancel()
			return new Response(null, { status: 413 })
		}
		chunks.push(chunk.value)
	}
	const bytes = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	const input = new TextDecoder().decode(bytes)
	let alert: z.infer<typeof AlertPayload>
	try {
		alert = (EventPayloadSchemas[subscription.alertType] ?? AlertPayload).parse(JSON.parse(input))
	} catch {
		return new Response(null, { status: 400 })
	}
	if (
		!SUPPORTED_ALERT_TYPES.has(subscription.alertType) ||
		alert.account_id !== subscription.accountId ||
		alert.policy_id !== subscription.policyId ||
		alert.alert_type !== subscription.alertType
	) {
		return new Response(null, { status: 403 })
	}
	const occurrenceTime = new Date(alert.ts * 1000)
	if (!Number.isFinite(occurrenceTime.getTime())) return new Response(null, { status: 400 })
	const identity = await dependencies.eventIdentity(subscription, alert)
	if (!identity) return new Response(null, { status: 503 })
	const eventId = `evt_${await digest(JSON.stringify([subscription.id, identity]))}`
	const body = JSON.stringify({
		eventId,
		name: `cloudflare.alert.${subscription.alertType}`,
		timestamp: occurrenceTime.toISOString(),
		data: alert,
		cursor: null,
	})
	if (new TextEncoder().encode(body).length > MAX_EVENT_BYTES) {
		return new Response(null, { status: 413 })
	}
	try {
		CallbackUrl.parse(subscription.callbackUrl)
		const response = await dependencies.webhookFetch(subscription.callbackUrl, {
			method: 'POST',
			redirect: 'error',
			signal: AbortSignal.timeout(10_000),
			headers: await signedHeaders(subscription, eventId, body, now),
			body,
		})
		if (response.ok) return new Response(null, { status: 204 })
		if (response.status === 410) {
			await dependencies.deactivateSubscription(id)
			return new Response(null, { status: 204 })
		}
		if (response.status === 429 || response.status >= 500 || response.status < 400) {
			return new Response(null, { status: 503 })
		}
		return new Response(null, { status: response.status })
	} catch {
		return new Response(null, { status: 503 })
	}
}
