import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { AccountManager, CF_ACCOUNT_ID_HEADER } from './account-manager'
import { buildAccountTool } from './account-tool'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { AccountToolCallback } from './account-tool'
import type { AuthProps } from './cloudflare-oauth-handler'

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

/** Minimal RequestHandlerExtra carrying just the request headers the wrapper reads. */
function extra(headers?: Record<string, string>) {
	return { requestInfo: headers ? { headers } : undefined } as never
}

/** Build a demo account tool that records the account id its handler receives. */
function buildDemo(props: AuthProps) {
	const received: string[] = []
	const shape = { foo: z.string().optional() }
	const handler: AccountToolCallback<typeof shape> = (_args, accountId) => {
		received.push(accountId)
		return { content: [{ type: 'text', text: accountId }] }
	}
	const built = buildAccountTool(new AccountManager(props), shape, handler)
	return { ...built, received }
}

describe('buildAccountTool — schema shape', () => {
	it('omits account_id when the account is auth-pinned', () => {
		const { shape } = buildDemo(accountTokenProps)
		expect(shape).toHaveProperty('foo')
		expect(shape).not.toHaveProperty('account_id')
	})

	it('adds an optional account_id when the token is multi-account', () => {
		const { shape } = buildDemo(multiAccountProps)
		expect(shape).toHaveProperty('account_id')
	})
})

describe('buildAccountTool — resolution at call time', () => {
	it('pinned token: handler gets the token account regardless of header/arg', async () => {
		const { callback, received } = buildDemo(accountTokenProps)
		await callback({ account_id: 'acc-999' }, extra({ [CF_ACCOUNT_ID_HEADER]: 'acc-999' }))
		expect(received).toEqual(['acc-1'])
	})

	it('multi-account: cf-account-id header resolves (Layer 2)', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		await callback({}, extra({ [CF_ACCOUNT_ID_HEADER]: 'acc-2' }))
		expect(received).toEqual(['acc-2'])
	})

	it('multi-account: account_id argument resolves when no header (Layer 3)', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		await callback({ account_id: 'acc-2' }, extra())
		expect(received).toEqual(['acc-2'])
	})

	it('multi-account: header takes precedence over argument', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		await callback({ account_id: 'acc-2' }, extra({ [CF_ACCOUNT_ID_HEADER]: 'acc-1' }))
		expect(received).toEqual(['acc-1'])
	})

	it('multi-account with no selection: returns an error and never calls the handler', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		const result = (await callback({}, extra())) as CallToolResult
		expect(result.isError).toBe(true)
		expect(received).toEqual([])
	})

	it('multi-account with an invalid header: returns an error and never calls the handler', async () => {
		const { callback, received } = buildDemo(multiAccountProps)
		const result = (await callback(
			{},
			extra({ [CF_ACCOUNT_ID_HEADER]: 'acc-999' })
		)) as CallToolResult
		expect(result.isError).toBe(true)
		expect(received).toEqual([])
	})
})
