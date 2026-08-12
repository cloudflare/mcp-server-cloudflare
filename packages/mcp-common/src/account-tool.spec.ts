import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { AccountManager, CF_ACCOUNT_ID_HEADER } from './account-manager'
import { buildAccountTool } from './account-tool'

import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'
import type { AccountToolCallback } from './account-tool'
import type { AuthProps } from './auth-props'

const accountTokenProps: AuthProps = {
	type: 'account_token',
	accessToken: 'tok',
	account: { id: 'acc-1', name: 'Solo' },
}

const multiAccountProps: AuthProps = {
	type: 'user_token',
	accessToken: 'tok',
	user: { id: 'u1', email: 'user@example.com' },
	accounts: [
		{ id: 'acc-1', name: 'One' },
		{ id: 'acc-2', name: 'Two' },
	],
}

const toolContext = {} as ServerContext

function request(headers?: Record<string, string>) {
	return new Request('https://mcp.example.com/mcp', { headers })
}

function buildDemo(props: AuthProps, headers?: Record<string, string>) {
	const received: string[] = []
	const inputSchema = z.object({ foo: z.string().optional() })
	const handler: AccountToolCallback<typeof inputSchema.shape> = (_args, accountId) => {
		received.push(accountId)
		return { content: [{ type: 'text', text: accountId }] }
	}
	const built = buildAccountTool(new AccountManager(props), request(headers), inputSchema, handler)
	return { ...built, received }
}

describe('buildAccountTool — schema', () => {
	it('omits account_id when auth pins the account', () => {
		const { inputSchema } = buildDemo(accountTokenProps)
		expect(inputSchema.shape).toHaveProperty('foo')
		expect(inputSchema.shape).not.toHaveProperty('account_id')
	})

	it('adds account_id when credentials span accounts', () => {
		const { inputSchema } = buildDemo(multiAccountProps)
		expect(inputSchema.shape).toHaveProperty('account_id')
	})
})

describe('buildAccountTool — request-local resolution', () => {
	it('uses the auth-pinned account regardless of header or argument', async () => {
		const { callback, received } = buildDemo(accountTokenProps, {
			[CF_ACCOUNT_ID_HEADER]: 'acc-999',
		})
		await callback({ account_id: 'acc-999' }, toolContext)
		expect(received).toEqual(['acc-1'])
	})

	it('uses the request header before the tool argument', async () => {
		const { callback, received } = buildDemo(multiAccountProps, {
			[CF_ACCOUNT_ID_HEADER]: 'acc-1',
		})
		await callback({ account_id: 'acc-2' }, toolContext)
		expect(received).toEqual(['acc-1'])
	})

	it('falls back to the tool argument', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		await callback({ account_id: 'acc-2' }, toolContext)
		expect(received).toEqual(['acc-2'])
	})

	it('returns an error without retaining a selection', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		const result = (await callback({}, toolContext)) as CallToolResult
		expect(result.isError).toBe(true)
		expect(received).toEqual([])
	})

	it('rejects a header outside the authorized account set', async () => {
		const { callback, received } = buildDemo(multiAccountProps, {
			[CF_ACCOUNT_ID_HEADER]: 'acc-999',
		})
		const result = (await callback({}, toolContext)) as CallToolResult
		expect(result.isError).toBe(true)
		expect(received).toEqual([])
	})
})
