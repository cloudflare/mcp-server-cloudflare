import { RestAiRunner } from './ai/runner'
import { MemoryIndexClient } from './search/client'
import { createRestR2Storage } from './storage/r2'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './agent-memory.context'
import type { AiRunner, CloudflareCredentials } from './ai/runner'
import type { R2Storage } from './storage/r2'

/**
 * Per-request user context.
 *
 * Bundles everything a tool handler needs to act on behalf of one user,
 * scoped to their Cloudflare account:
 *   - `storage`  — their R2 bucket (billed to them)
 *   - `ai`       — Workers AI via REST on their account (billed to them)
 *   - `index`    — their isolated search-index Durable Object
 *
 * Built fresh per tool call from the resolved account id (see
 * `AccountManager`) and the OAuth access token in `props`.
 */

export interface UserContext {
	userId: string
	creds: CloudflareCredentials
	storage: R2Storage
	ai: AiRunner
	index: MemoryIndexClient
	env: Env
}

/**
 * Stable per-user identifier used to name the search-index DO and (implicitly)
 * to isolate a user's data. User tokens key on the Cloudflare user id;
 * account-scoped tokens key on the account id.
 */
export function userIdFromProps(props: AuthProps): string {
	return props.type === 'user_token' ? props.user.id : props.account.id
}

export function buildUserContext(env: Env, props: AuthProps, accountId: string): UserContext {
	const creds: CloudflareCredentials = { accountId, apiToken: props.accessToken }
	const userId = userIdFromProps(props)
	const storage = createRestR2Storage(creds, env.AGENT_MEMORY_BUCKET_NAME)
	const ai = new RestAiRunner(creds)
	const index = new MemoryIndexClient(env, userId, creds)
	return { userId, creds, storage, ai, index, env }
}
