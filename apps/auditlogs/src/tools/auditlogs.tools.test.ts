import { describe, expect, it } from 'vitest'

import { auditLogsResponseSchema } from './auditlogs.tools'

describe('auditLogsResponseSchema', () => {
	it('accepts audit log entries with api actor context', () => {
		const result = auditLogsResponseSchema.safeParse({
			success: true,
			errors: [],
			result: [
				{
					id: '00000000-0000-0000-0000-000000000000',
					account: {
						id: 'account-id',
						name: 'Example Account',
					},
					action: {
						result: 'success',
						time: '2026-05-15T17:30:00.000Z',
						type: 'update',
					},
					actor: {
						context: 'api',
						type: 'user',
					},
				},
			],
			result_info: {
				count: 1,
			},
		})

		expect(result.success).toBe(true)
	})
})
