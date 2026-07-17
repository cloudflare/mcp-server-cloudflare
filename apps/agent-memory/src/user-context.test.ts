import { describe, expect, it, vi } from 'vitest'

import { buildUserContext } from './user-context'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './agent-memory.context'

function envWithIndexSpy() {
	const idFromName = vi.fn().mockReturnValue('do-id')
	const get = vi.fn().mockReturnValue({})
	const env = {
		AGENT_MEMORY_BUCKET_NAME: 'agent-memory-mcp',
		MEMORY_INDEX: { idFromName, get },
	} as unknown as Env
	return { env, idFromName }
}

describe('buildUserContext', () => {
	it('scopes the index to the resolved account for user tokens', () => {
		const props: AuthProps = {
			type: 'user_token',
			accessToken: 'token',
			user: { id: 'user-1', email: 'test@example.com' },
			accounts: [
				{ id: 'account-a', name: 'A' },
				{ id: 'account-b', name: 'B' },
			],
		}
		const { env, idFromName } = envWithIndexSpy()

		const context = buildUserContext(env, props, 'account-b')

		expect(context.accountId).toBe('account-b')
		expect(idFromName).toHaveBeenCalledWith('account-b')
	})

	it('uses the same account scope for account tokens', () => {
		const props: AuthProps = {
			type: 'account_token',
			accessToken: 'token',
			account: { id: 'account-a', name: 'A' },
		}
		const { env, idFromName } = envWithIndexSpy()

		const context = buildUserContext(env, props, 'account-a')

		expect(context.accountId).toBe('account-a')
		expect(idFromName).toHaveBeenCalledWith('account-a')
	})
})
