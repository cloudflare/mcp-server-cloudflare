import { env } from 'cloudflare:test'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@repo/mcp-common/src/test/msw-server'
import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './auditlogs.app'
import { handleGetAuditLogs } from './tools/auditlogs.tools'

import type { Env } from './auditlogs.context'

testStatelessMcpApp<Env>({
	name: 'Audit Logs',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://auditlogs.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: ['auditlogs_by_account_id'],
})

describe('Audit Logs responses', () => {
	it('preserves records and the pagination cursor when actor contexts include api', async () => {
		server.use(
			http.get('https://api.cloudflare.com/client/v4/accounts/account-1/logs/audit', () =>
				HttpResponse.json({
					success: true,
					result: [
						{
							id: 'audit-log-1',
							account: { id: 'account-1', name: 'Test account' },
							action: {
								description: 'Created a token',
								result: 'success',
								time: '2026-09-15T10:00:00.000Z',
								type: 'create',
							},
							actor: { context: 'api', email: 'api@example.com' },
							resource: { product: 'API Tokens', type: 'token' },
						},
						{
							id: 'audit-log-2',
							account: { id: 'account-1', name: 'Test account' },
							action: {
								description: 'Viewed a zone',
								result: 'success',
								time: '2026-09-15T10:01:00.000Z',
								type: 'view',
							},
							actor: { context: 'api_token', email: 'user@example.com' },
							resource: { product: 'Zone', type: 'zone' },
						},
					],
					result_info: { count: 2, cursor: 'next-page-cursor' },
				})
			)
		)

		const result = await handleGetAuditLogs('account-1', 'api-token', {
			since: '2026-09-15',
			before: '2026-09-16',
		})

		expect(result).toEqual({
			logs: [
				{
					description: 'Created a token',
					time: '2026-09-15T10:00:00.000Z',
					actor_email: 'api@example.com',
					actor_token_name: undefined,
					product: 'API Tokens',
					type: 'token',
				},
				{
					description: 'Viewed a zone',
					time: '2026-09-15T10:01:00.000Z',
					actor_email: 'user@example.com',
					actor_token_name: undefined,
					product: 'Zone',
					type: 'zone',
				},
			],
			result_info: { count: 2, cursor: 'next-page-cursor' },
		})
	})
})
