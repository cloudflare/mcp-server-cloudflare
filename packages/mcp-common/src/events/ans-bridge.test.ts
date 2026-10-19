import { describe, expect, it, vi } from 'vitest'

import {
	alertEventDefinitions,
	forwardAnsWebhook,
	MAX_EVENT_BYTES,
	signedHeaders,
	SubscribeParams,
	subscriptionExpiration,
	subscriptionId,
	verifyCallback,
} from './ans-bridge'

import type { BridgeDependencies, Subscription } from './ans-bridge'

const accountId = 'a'.repeat(32)
const secret = `whsec_${btoa('a'.repeat(32))}`
const subscription: Subscription = {
	id: 'sub_test',
	principal: 'user:123',
	accountId,
	policyId: 'policy-1',
	alertType: 'workers_observability_real_time_issue',
	callbackUrl: 'https://receiver.example/callback',
	signingSecret: secret,
	ingressSecret: 'ans-only-secret',
	expiresAt: 200_000,
	active: true,
}
const params = {
	name: 'cloudflare.alert.workers_observability_real_time_issue',
	arguments: { account_id: accountId, filters: { services: ['my-worker'] } },
	delivery: { mode: 'webhook', url: subscription.callbackUrl, secret },
}
const alert = {
	name: 'ANS notification',
	text: 'Untrusted notification text',
	account_id: accountId,
	policy_id: 'policy-1',
	alert_type: 'workers_observability_real_time_issue',
	alert_correlation_id: 'persisted-vega-run-id',
	ts: 100,
	data: {
		issue: { id: 'issue-1', services: [{ name: 'my-worker' }], title: 'Untrusted issue text' },
	},
}

function request(value: unknown = alert, token = subscription.ingressSecret) {
	return new Request('https://mcp.example/events/ans/sub_test', {
		method: 'POST',
		headers: { 'cf-webhook-auth': token },
		body: JSON.stringify(value),
	})
}

function dependencies(status = 204): BridgeDependencies {
	return {
		loadSubscription: vi.fn(async () => ({ ...subscription })),
		hasAccess: vi.fn(async () => true),
		deactivateSubscription: vi.fn(async () => {}),
		eventIdentity: vi.fn(async (_subscription, payload) => payload.alert_correlation_id ?? ''),
		webhookFetch: vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch,
		now: () => 100_000,
	}
}

describe('MCP event contract', () => {
	it('validates subscription arguments and signing keys', () => {
		expect(SubscribeParams.parse(params)).toEqual(params)
		for (const value of ['bad', 'whsec_!!!!', `whsec_${btoa('short')}`]) {
			expect(
				SubscribeParams.safeParse({ ...params, delivery: { ...params.delivery, secret: value } })
					.success
			).toBe(false)
		}
	})

	it.each([
		'http://receiver.example',
		'https://user:pass@receiver.example',
		'https://receiver.example/#fragment',
	])('rejects an invalid callback %s', (url) => {
		expect(
			SubscribeParams.safeParse({ ...params, delivery: { ...params.delivery, url } }).success
		).toBe(false)
	})

	it('keeps identity stable across argument ordering, refresh and key rotation', async () => {
		const id = await subscriptionId('user:123', params)
		expect(
			await subscriptionId('user:123', {
				...params,
				ttlMs: 1000,
				arguments: { filters: { services: ['my-worker'] }, account_id: accountId },
				delivery: { ...params.delivery, secret: `whsec_${btoa('b'.repeat(32))}` },
			})
		).toBe(id)
		expect(await subscriptionId('user:456', params)).not.toBe(id)
		expect(
			await subscriptionId('user:123', {
				...params,
				delivery: { mode: 'webhook', url: params.delivery.url },
			})
		).toBe(id)
	})

	it('grants a finite bounded lifetime, including for requests without expiry', () => {
		expect(subscriptionExpiration(100, 1000)).toBe(1100)
		expect(subscriptionExpiration(100, null)).toBe(86_400_100)
		expect(subscriptionExpiration(100, 172_800_000)).toBe(86_400_100)
		expect(() => subscriptionExpiration(100, -1)).toThrow()
	})

	it('matches an independently calculated Standard Webhooks signature', async () => {
		const body = '{"eventId":"evt_1"}'
		const headers = await signedHeaders(subscription, 'evt_1', body, 100_000)
		const expected = 'Uk++cO75SKUwxzWywfoTryzRPN77PsDiIixiMPVNwdg='
		expect(headers.get('webhook-signature')).toBe(`v1,${expected}`)
		expect(headers.get('webhook-id')).toBe('evt_1')
		expect(headers.get('X-MCP-Subscription-Id')).toBe(subscription.id)
	})

	it('supports a bounded dual-signature rotation window', async () => {
		const rotated = {
			...subscription,
			previousSigningSecret: `whsec_${btoa('b'.repeat(32))}`,
			previousSecretExpiresAt: 101_000,
		}
		expect(
			(await signedHeaders(rotated, 'evt_1', '{}', 100_000)).get('webhook-signature')?.split(' ')
		).toHaveLength(2)
		expect(
			(await signedHeaders(rotated, 'evt_1', '{}', 102_000)).get('webhook-signature')?.split(' ')
		).toHaveLength(1)
	})

	it('verifies a fresh callback challenge with redirect blocking', async () => {
		const transport = vi.fn(async (_url: unknown, init: RequestInit) => {
			expect(init.redirect).toBe('error')
			const body = JSON.parse(init.body as string)
			expect(body.type).toBe('verification')
			expect(new Headers(init.headers).get('webhook-id')).toMatch(/^msg_verification_/)
			return Response.json({ challenge: body.challenge })
		})
		await expect(
			verifyCallback(subscription, transport as unknown as typeof fetch, 100_000)
		).resolves.toBeUndefined()
	})

	it('rejects a callback that does not echo the challenge', async () => {
		const transport = vi.fn(async () => Response.json({ challenge: 'wrong' }))
		await expect(
			verifyCallback(subscription, transport as unknown as typeof fetch, 100_000)
		).rejects.toThrow()
	})
})

describe('ANS synchronous delivery bridge', () => {
	it('advertises only implemented events that are eligible in the ANS catalog', () => {
		const events = alertEventDefinitions({
			Workers: [
				{
					type: 'workers_observability_real_time_issue',
					display_name: 'Worker Issue',
					description: 'An issue',
					filter_options: [],
				},
			],
			Origin: [
				{
					type: 'http_alert_origin_error',
					display_name: 'Origin Error',
					description: 'Origin errors',
					filter_options: [{ Key: 'zones', Range: '1-n', AvailableValues: null }],
				},
			],
		})
		expect(events.map((event) => event.name)).toEqual([
			'cloudflare.alert.workers_observability_real_time_issue',
		])
		expect(
			alertEventDefinitions({
				Origin: [
					{
						type: 'http_alert_origin_error',
						display_name: 'Origin Error',
						description: 'Origin errors',
						filter_options: [],
					},
				],
			})
		).toEqual([])
	})

	it('does not accept subscriptions to events without an implemented contract', async () => {
		const deps = dependencies()
		deps.loadSubscription = vi.fn(async () => ({
			...subscription,
			alertType: 'http_alert_origin_error',
		}))
		const notification = {
			...alert,
			alert_type: 'http_alert_origin_error',
			data: { zone_id: 'zone-1' },
		}
		expect((await forwardAnsWebhook(request(notification), subscription.id, deps)).status).toBe(403)
		expect(deps.webhookFetch).not.toHaveBeenCalled()
		expect(
			SubscribeParams.safeParse({ ...params, name: 'cloudflare.alert.http_alert_origin_error' })
				.success
		).toBe(false)
	})

	it.each([
		[204, 204],
		[202, 204],
		[408, 503],
		[429, 503],
		[500, 503],
		[502, 503],
		[302, 503],
		[401, 401],
		[413, 413],
	])('maps callback status %i to ANS status %i', async (callbackStatus, ansStatus) => {
		expect(
			(await forwardAnsWebhook(request(), subscription.id, dependencies(callbackStatus))).status
		).toBe(ansStatus)
	})

	it('waits for callback acceptance before acknowledging ANS', async () => {
		const deps = dependencies()
		let resolve: (response: Response) => void = () => {}
		deps.webhookFetch = vi.fn(
			() =>
				new Promise<Response>((done) => {
					resolve = done
				})
		) as unknown as typeof fetch
		const delivery = forwardAnsWebhook(request(), subscription.id, deps)
		await vi.waitFor(() => expect(deps.webhookFetch).toHaveBeenCalledOnce())
		let acknowledged = false
		void delivery.then(() => {
			acknowledged = true
		})
		expect(acknowledged).toBe(false)
		resolve(new Response(null, { status: 204 }))
		expect((await delivery).status).toBe(204)
	})

	it('preserves event ID and body across retries while refreshing signatures', async () => {
		const deps = dependencies(503)
		await forwardAnsWebhook(request(), subscription.id, deps)
		deps.now = () => 110_000
		await forwardAnsWebhook(request(), subscription.id, deps)
		const calls = vi.mocked(deps.webhookFetch).mock.calls
		const first = calls[0][1]!
		const second = calls[1][1]!
		expect(first.body).toBe(second.body)
		const firstHeaders = new Headers(first.headers)
		const secondHeaders = new Headers(second.headers)
		expect(firstHeaders.get('webhook-id')).toBe(secondHeaders.get('webhook-id'))
		expect(firstHeaders.get('webhook-signature')).not.toBe(secondHeaders.get('webhook-signature'))
		expect(JSON.parse(first.body as string).timestamp).toBe('1970-01-01T00:01:40.000Z')
		expect(first.redirect).toBe('error')
	})

	it('requires the ANS ingress secret and account/policy/alert-type scope', async () => {
		const deps = dependencies()
		expect((await forwardAnsWebhook(request(alert, 'wrong'), subscription.id, deps)).status).toBe(
			401
		)
		for (const invalid of [
			{ ...alert, account_id: 'b'.repeat(32) },
			{ ...alert, policy_id: 'other-policy' },
			{ ...alert, alert_type: 'other-alert' },
		]) {
			expect((await forwardAnsWebhook(request(invalid), subscription.id, deps)).status).toBe(403)
		}
		expect(deps.webhookFetch).not.toHaveBeenCalled()
	})

	it('never uses the resource ID as the delivery identity', async () => {
		const deps = dependencies()
		expect(
			(
				await forwardAnsWebhook(
					request({ ...alert, alert_correlation_id: '' }),
					subscription.id,
					deps
				)
			).status
		).toBe(503)
		expect(deps.webhookFetch).not.toHaveBeenCalled()
	})

	it('rejects notifications that do not match the issue payload contract', async () => {
		const deps = dependencies()
		expect(
			(
				await forwardAnsWebhook(
					request({ ...alert, data: { unrelated: true } }),
					subscription.id,
					deps
				)
			).status
		).toBe(400)
		expect(deps.webhookFetch).not.toHaveBeenCalled()
	})

	it('does not send expired or inactive subscriptions', async () => {
		for (const record of [
			{ ...subscription, active: false },
			{ ...subscription, expiresAt: 99_000 },
		]) {
			const deps = dependencies()
			deps.loadSubscription = vi.fn(async () => record)
			expect((await forwardAnsWebhook(request(), subscription.id, deps)).status).toBe(204)
			expect(deps.webhookFetch).not.toHaveBeenCalled()
		}
	})

	it('deactivates subscriptions on revoked access or callback 410', async () => {
		const revoked = dependencies()
		revoked.hasAccess = vi.fn(async () => false)
		expect((await forwardAnsWebhook(request(), subscription.id, revoked)).status).toBe(204)
		expect(revoked.webhookFetch).not.toHaveBeenCalled()
		expect(revoked.deactivateSubscription).toHaveBeenCalledWith(subscription.id)
		const gone = dependencies(410)
		expect((await forwardAnsWebhook(request(), subscription.id, gone)).status).toBe(204)
		expect(gone.deactivateSubscription).toHaveBeenCalledWith(subscription.id)
	})

	it('returns a retryable status for network failures', async () => {
		const deps = dependencies()
		deps.webhookFetch = vi.fn(async () => {
			throw new Error('timeout')
		}) as unknown as typeof fetch
		expect((await forwardAnsWebhook(request(), subscription.id, deps)).status).toBe(503)
		expect(deps.webhookFetch).toHaveBeenCalledOnce()
	})

	it('makes one delivery attempt and leaves retries to ANS', async () => {
		const deps = dependencies(503)
		expect((await forwardAnsWebhook(request(), subscription.id, deps)).status).toBe(503)
		expect(deps.webhookFetch).toHaveBeenCalledOnce()
		expect(deps.deactivateSubscription).not.toHaveBeenCalled()
	})

	it('leaves transient access-check failures to ANS without deactivating', async () => {
		const deps = dependencies()
		deps.hasAccess = vi.fn(async () => {
			throw new Error('Service unavailable')
		})
		expect((await forwardAnsWebhook(request(), subscription.id, deps)).status).toBe(503)
		expect(deps.webhookFetch).not.toHaveBeenCalled()
		expect(deps.deactivateSubscription).not.toHaveBeenCalled()
	})

	it('bounds inbound and outgoing event bodies', async () => {
		const deps = dependencies()
		const oversized = {
			...alert,
			data: { issue: { ...alert.data.issue, title: 'x'.repeat(MAX_EVENT_BYTES) } },
		}
		expect((await forwardAnsWebhook(request(oversized), subscription.id, deps)).status).toBe(413)
		expect(deps.webhookFetch).not.toHaveBeenCalled()
	})
})
