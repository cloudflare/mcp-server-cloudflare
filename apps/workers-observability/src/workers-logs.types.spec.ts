import { describe, expect, it } from 'vitest'

import { zReturnedTelemetryEvent } from './types/workers-logs.types'

function telemetryEvent(workers: Record<string, unknown>) {
	return {
		dataset: 'cloudflare-workers',
		timestamp: 1726700000000,
		source: 'log message',
		$workers: {
			event: {},
			scriptName: 'my-worker',
			requestId: 'request-id',
			...workers,
		},
		$metadata: { id: 'event-id', origin: 'cron' },
	}
}

describe('zReturnedTelemetryEvent', () => {
	it('accepts cron-triggered events, which have no outcome', () => {
		const result = zReturnedTelemetryEvent.safeParse(telemetryEvent({ eventType: 'cron' }))

		expect(result.success).toBe(true)
		expect(result.data?.$workers?.outcome).toBeUndefined()
	})

	it('keeps the outcome of events that report one', () => {
		const result = zReturnedTelemetryEvent.safeParse(
			telemetryEvent({ eventType: 'fetch', outcome: 'ok' })
		)

		expect(result.success).toBe(true)
		expect(result.data?.$workers?.outcome).toBe('ok')
	})
})
