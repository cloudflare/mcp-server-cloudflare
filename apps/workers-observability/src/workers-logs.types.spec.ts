import { describe, expect, it } from 'vitest'

import { V4Schema } from '@repo/mcp-common/src/v4-api'

import { zReturnedQueryRunResult } from './types/workers-logs.types'

function telemetryEvent(id: string, workers: Record<string, unknown>) {
	return {
		dataset: 'cloudflare-workers',
		timestamp: 1_774_854_000_000,
		source: 'log line',
		$workers: { event: {}, scriptName: 'my-worker', requestId: 'request-id', ...workers },
		$metadata: { id, service: 'my-worker' },
	}
}

function queryResponse(events: unknown[]) {
	return {
		result: {
			events: { events, count: events.length },
			statistics: { elapsed: 0.01, rows_read: events.length, bytes_read: 256 },
		},
		success: true,
		errors: [],
		messages: [],
	}
}

describe('Workers Observability query response', () => {
	it('keeps every event when some have no outcome', () => {
		const response = V4Schema(zReturnedQueryRunResult).parse(
			queryResponse([
				// Cron invocations report no outcome or timing fields.
				telemetryEvent('cron', { eventType: 'cron', executionModel: 'stateless' }),
				// console.log lines inside an invocation report no outcome.
				telemetryEvent('log', { eventType: 'fetch' }),
				telemetryEvent('fetch', { eventType: 'fetch', outcome: 'ok', cpuTimeMs: 1, wallTimeMs: 2 }),
			])
		)

		expect(response.result?.events?.events?.map((event) => event.$workers?.outcome)).toEqual([
			undefined,
			undefined,
			'ok',
		])
	})

	it('keeps events with event types and execution models it does not know yet', () => {
		const response = V4Schema(zReturnedQueryRunResult).parse(
			queryResponse([telemetryEvent('new', { eventType: 'connect', executionModel: 'container' })])
		)

		expect(response.result?.events?.events?.[0]?.$workers).toMatchObject({
			eventType: 'connect',
			executionModel: 'container',
		})
	})
})
