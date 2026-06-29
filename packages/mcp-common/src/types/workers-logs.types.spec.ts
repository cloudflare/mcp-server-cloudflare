import { describe, expect, it } from 'vitest'

import { zReturnedTelemetryEvent } from './workers-logs.types'

describe('zReturnedTelemetryEvent', () => {
	it('preserves custom Workers log source fields', () => {
		const event = zReturnedTelemetryEvent.parse({
			dataset: 'cloudflare-workers',
			timestamp: 1775208144119,
			source: {
				event: 'sync_complete',
				userId: 'abc-123',
				synced: 10,
				durationMs: 1307,
			},
			$metadata: {
				id: 'log-event-id',
			},
		})

		expect(event.source).toEqual({
			event: 'sync_complete',
			userId: 'abc-123',
			synced: 10,
			durationMs: 1307,
		})
	})
})
