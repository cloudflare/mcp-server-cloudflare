import { DurableObject } from 'cloudflare:workers'
import { z } from 'zod'

import { DurableKVStore } from '../durable-kv-store'

import type { DurableKVStorageKeys } from '../durable-kv-store'

// Durable Object for persisting UserDetails in DO storage across sessions based off the userId
export class UserDetails extends DurableObject {
	private readonly kv: DurableKVStore<UserDetailsKeys>
	constructor(state: DurableObjectState, env: unknown) {
		super(state, env)
		this.env = env
		this.kv = new DurableKVStore({
			state,
			prefix: 'meta',
			keys: UserDetailsKeys,
		})
	}

	public async getActiveAccountId() {
		return await this.kv.get('active_account_id')
	}

	public async setActiveAccountId(activeAccountId: string) {
		this.kv.put('active_account_id', activeAccountId)
	}
}

/**
 * Storage keys used by UserDetails
 */
type UserDetailsKeys = typeof UserDetailsKeys
const UserDetailsKeys = {
	active_account_id: z.string(),
} as const satisfies DurableKVStorageKeys

/** Get the UserDetails instance */
export function getUserDetails(
	env: { USER_DETAILS: DurableObjectNamespace<UserDetails> },
	user_id: string
): DurableObjectStub<UserDetails> {
	const id = env.USER_DETAILS.idFromName(user_id)
	return env.USER_DETAILS.get(id)
}
