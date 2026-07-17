import { RestAiRunner } from './ai/runner'
import { MemoryIndexClient } from './search/client'
import { createRestR2Storage } from './storage/r2'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './agent-memory.context'
import type { AiRunner, CloudflareCredentials } from './ai/runner'
import type { R2Storage } from './storage/r2'

/**
 * Per-request account context.
 *
 * Bundles everything a tool handler needs for the account selected by
 * `AccountManager`:
 *   - `storage` — the account's R2 bucket
 *   - `ai`      — Workers AI via REST, billed to the account
 *   - `index`   — the account's isolated search-index Durable Object
 *
 * Built fresh per tool call from the resolved account id (see
 * `AccountManager`) and the OAuth access token in `props`.
 */

export interface UserContext {
	/** Account selected by AccountManager for this tool call. */
	accountId: string
	creds: CloudflareCredentials
	storage: R2Storage
	ai: AiRunner
	index: MemoryIndexClient
	env: Env
}

/** Stable identity used only for session metrics. */
export function userIdFromProps(props: AuthProps): string {
	return props.type === 'user_token' ? props.user.id : props.account.id
}

export function buildUserContext(env: Env, props: AuthProps, accountId: string): UserContext {
	const creds: CloudflareCredentials = { accountId, apiToken: props.accessToken }
	const storage = createRestR2Storage(creds, env.AGENT_MEMORY_BUCKET_NAME)
	const ai = new RestAiRunner(creds)
	// Files live in one bucket in the selected account, so the derived index
	// must use the same account boundary. Keying by user would mix accounts for
	// multi-account users and create divergent indexes for account members.
	const index = new MemoryIndexClient(env, accountId, creds)
	return { accountId, creds, storage, ai, index, env }
}
