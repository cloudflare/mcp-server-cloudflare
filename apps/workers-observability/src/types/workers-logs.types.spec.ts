import { describe, expect, it } from 'vitest'

import { zCloudflareMiniEvent, zReturnedQueryRunEvents } from './workers-logs.types'

describe('zCloudflareMiniEvent', () => {
	it('parses a console.log event with no outcome', () => {
		const event = {
			event: {},
			scriptName: 'my-worker',
			eventType: 'cron',
			requestId: '1RI7X6A7OCMC159U',
		}
		expect(() => zCloudflareMiniEvent.parse(event)).not.toThrow()
	})

	it('still parses an invocation-summary event with an outcome', () => {
		const event = {
			event: {},
			scriptName: 'my-worker',
			eventType: 'cron',
			requestId: '1RI7X6A7OCMC159U',
			outcome: 'ok',
		}
		expect(zCloudflareMiniEvent.parse(event).outcome).toBe('ok')
	})
})

describe('zReturnedQueryRunEvents', () => {
	it('does not discard the batch when one event has no outcome', () => {
		const telemetryEvent = (workers: Record<string, unknown>) => ({
			dataset: 'cloudflare-workers',
			timestamp: 1784222146000,
			source: 'log line',
			$workers: {
				event: {},
				scriptName: 'my-worker',
				eventType: 'cron',
				requestId: '1RI7X6A7OCMC159U',
				...workers,
			},
			$metadata: { id: 'evt-1' },
		})
		const result = zReturnedQueryRunEvents.parse({
			events: [telemetryEvent({}), telemetryEvent({ outcome: 'ok' })],
		})
		expect(result.events).toHaveLength(2)
	})
})
