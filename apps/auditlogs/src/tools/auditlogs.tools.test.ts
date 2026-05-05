import { describe, expect, it } from 'vitest'

import { auditLogsResponseSchema } from './auditlogs.tools'

describe('auditLogsResponseSchema', () => {
	it('accepts audit log entries created by API actors', () => {
		expect(() =>
			auditLogsResponseSchema.parse({
				success: true,
				result: [
					{
						id: 'audit-log-id',
						account: {
							id: 'account-id',
							name: 'Account',
						},
						action: {
							result: 'success',
							time: '2026-05-06T00:00:00.000Z',
							type: 'view',
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
		).not.toThrow()
	})
})
