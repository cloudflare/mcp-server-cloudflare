import { describe, expect, it } from 'vitest'

import { AccountManager } from './account-manager'

import type { AuthProps } from './cloudflare-oauth-handler'

const accountTokenProps: AuthProps = {
	type: 'account_token',
	accessToken: 'tok',
	account: { id: 'acc-1', name: 'Solo Account' },
}

const singleAccountUserProps: AuthProps = {
	type: 'user_token',
	accessToken: 'tok',
	user: { id: 'u1', email: 'user@example.com' },
	accounts: [{ id: 'acc-1', name: 'Only Account' }],
}

const multiAccountUserProps: AuthProps = {
	type: 'user_token',
	accessToken: 'tok',
	user: { id: 'u1', email: 'user@example.com' },
	accounts: [
		{ id: 'acc-1', name: 'Account One' },
		{ id: 'acc-2', name: 'Account Two' },
	],
}

/** Parse the JSON payload out of an error CallToolResult. */
function errorPayload(result: { content: Array<{ type: string; text?: string }> }) {
	const text = result.content[0]?.text ?? '{}'
	return JSON.parse(text) as {
		error: string
		available_accounts: Array<{ id: string; name: string }>
	}
}

describe('AccountManager — Layer 1 (auth-pinned)', () => {
	it('account_token pins its single account and ignores header/argument', () => {
		const m = new AccountManager(accountTokenProps)
		expect(m.pinnedAccountId).toBe('acc-1')
		expect(m.requiresAccountSelection).toBe(false)
		expect(m.resolve({})).toEqual({ accountId: 'acc-1' })
		// header / arg pointing elsewhere are ignored — the account we have auth for wins
		expect(m.resolve({ header: 'acc-999' })).toEqual({ accountId: 'acc-1' })
		expect(m.resolve({ providedAccountId: 'acc-999' })).toEqual({ accountId: 'acc-1' })
	})

	it('single-account user_token pins that account and ignores header/argument', () => {
		const m = new AccountManager(singleAccountUserProps)
		expect(m.pinnedAccountId).toBe('acc-1')
		expect(m.requiresAccountSelection).toBe(false)
		expect(m.resolve({ header: 'acc-999', providedAccountId: 'acc-999' })).toEqual({
			accountId: 'acc-1',
		})
	})
})

describe('AccountManager — multi-account user_token', () => {
	const m = new AccountManager(multiAccountUserProps)

	it('requires selection', () => {
		expect(m.pinnedAccountId).toBeUndefined()
		expect(m.requiresAccountSelection).toBe(true)
	})

	it('Layer 2: a valid header resolves', () => {
		expect(m.resolve({ header: 'acc-2' })).toEqual({ accountId: 'acc-2' })
	})

	it('Layer 3: a valid account_id argument resolves', () => {
		expect(m.resolve({ providedAccountId: 'acc-2' })).toEqual({ accountId: 'acc-2' })
	})

	it('header beats argument when both are present', () => {
		expect(m.resolve({ header: 'acc-1', providedAccountId: 'acc-2' })).toEqual({
			accountId: 'acc-1',
		})
	})

	it('an invalid header errors and lists available accounts', () => {
		const result = m.resolve({ header: 'acc-999' })
		expect(result.accountId).toBeUndefined()
		expect(result.error?.isError).toBe(true)
		const payload = errorPayload(result.error!)
		expect(payload.error).toContain('cf-account-id')
		expect(payload.available_accounts.map((a) => a.id)).toEqual(['acc-1', 'acc-2'])
	})

	it('an invalid account_id argument errors and lists available accounts', () => {
		const result = m.resolve({ providedAccountId: 'acc-999' })
		expect(result.error?.isError).toBe(true)
		expect(errorPayload(result.error!).available_accounts).toHaveLength(2)
	})

	it('no header and no argument errors asking for account_id', () => {
		const result = m.resolve({})
		expect(result.error?.isError).toBe(true)
		const payload = errorPayload(result.error!)
		expect(payload.error).toContain('account_id is required')
		expect(payload.available_accounts.map((a) => a.id)).toEqual(['acc-1', 'acc-2'])
	})
})

describe('AccountManager.instructionsSuffix', () => {
	it('is empty when the account is pinned', () => {
		expect(new AccountManager(accountTokenProps).instructionsSuffix()).toBe('')
		expect(new AccountManager(singleAccountUserProps).instructionsSuffix()).toBe('')
	})

	it('lists name (id) for each account and explains account_id + cf-account-id when multi-account', () => {
		const suffix = new AccountManager(multiAccountUserProps).instructionsSuffix()
		expect(suffix).toContain('Account One (acc-1)')
		expect(suffix).toContain('Account Two (acc-2)')
		expect(suffix).toContain('account_id')
		expect(suffix).toContain('cf-account-id')
	})
})
