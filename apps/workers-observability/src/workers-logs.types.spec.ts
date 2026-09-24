import { describe, expect, it } from 'vitest'

import { V4Schema } from '@repo/mcp-common/src/v4-api'

import { zReturnedQueryRunResult } from './types/workers-logs.types'

describe('Workers Observability response schema', () => {
	it('accepts cron events without outcome or timing fields', () => {
		const response = V4Schema(zReturnedQueryRunResult).parse({
			result: {
				events: {
					events: [
						{
							dataset: 'cloudflare-workers',
							timestamp: 1_774_854_000_000,
							source: 'cron completed',
							$workers: {
								event: {},
								scriptName: 'scheduled-worker',
								eventType: 'cron',
								scriptVersion: { id: 'worker-version-id' },
								truncated: false,
								executionModel: 'stateless',
								requestId: 'cron-request-id',
							},
							$metadata: {
								id: 'cron-event-id',
								requestId: 'cron-request-id',
								service: 'scheduled-worker',
								origin: 'cron',
							},
						},
					],
					count: 1,
				},
				statistics: {
					elapsed: 0.01,
					rows_read: 1,
					bytes_read: 256,
				},
			},
			success: true,
			errors: [],
			messages: [],
		})

		expect(response.result?.events?.events?.[0]?.$workers).toMatchObject({
			eventType: 'cron',
			requestId: 'cron-request-id',
		})
	})
})
