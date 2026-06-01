import { z } from 'zod'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { AuthProps } from './cloudflare-oauth-handler'

/**
 * Request header a user can set in their MCP client config to pin a Cloudflare account.
 * Consulted only for multi-account OAuth tokens — see {@link AccountManager.resolve}.
 * The user sets this in config; the model cannot set request headers.
 */
export const CF_ACCOUNT_ID_HEADER = 'cf-account-id'

/**
 * Optional per-tool account selector. Exposed on a tool's input schema only when the
 * token spans multiple accounts (i.e. {@link AccountManager.requiresAccountSelection}).
 */
export const AccountIdParam = z
	.string()
	.optional()
	.describe(
		'The Cloudflare account ID to scope this call to. Only needed when your credentials can access multiple accounts and no cf-account-id header is configured.'
	)

type Account = { id: string; name: string }

export type ResolveResult =
	| { accountId: string; error?: never }
	| { accountId?: never; error: CallToolResult }

/**
 * Centralizes Cloudflare account-ID resolution for a single authenticated session.
 *
 * Resolution precedence (highest → lowest):
 *  1. Auth-pinned account — an account-scoped token's single account, or a user token with
 *     exactly one account. Definitive: a header/argument is ignored here (on mismatch the
 *     account we have auth for wins).
 *  2. `cf-account-id` request header — only for multi-account user tokens; the user sets it in
 *     their MCP client config.
 *  3. `account_id` tool argument — the fallback the model supplies at call time.
 *
 * Header/argument values are always validated against the accounts the token can access; an
 * account we lack authorization for is never used.
 */
export class AccountManager {
	constructor(private readonly props: AuthProps) {}

	/** All accounts the current credentials can access. */
	private get accounts(): Account[] {
		return this.props.type === 'account_token' ? [this.props.account] : this.props.accounts
	}

	/**
	 * Layer 1 — the account fixed by auth, known without any header or argument.
	 * Returns `undefined` only for a user token with multiple accounts (selection required).
	 */
	get pinnedAccountId(): string | undefined {
		if (this.props.type === 'account_token') {
			return this.props.account.id
		}
		if (this.props.accounts.length === 1) {
			return this.props.accounts[0]?.id
		}
		return undefined
	}

	/** True when tools must expose an `account_id` parameter (layers 1/2 can't pin the account). */
	get requiresAccountSelection(): boolean {
		return this.pinnedAccountId === undefined
	}

	/**
	 * Resolve the account id for a single tool call. See class docs for precedence.
	 */
	resolve({
		header,
		providedAccountId,
	}: {
		header?: string
		providedAccountId?: string
	}): ResolveResult {
		// Layer 1: auth pins the account — header/argument ignored (auth wins on mismatch).
		const pinned = this.pinnedAccountId
		if (pinned !== undefined) {
			return { accountId: pinned }
		}

		// Layer 2: cf-account-id header (user config). Authoritative when present.
		if (header) {
			if (this.accounts.some((a) => a.id === header)) {
				return { accountId: header }
			}
			return {
				error: this.errorResult(
					`The cf-account-id header "${header}" is not one of the accounts your credentials can access.`
				),
			}
		}

		// Layer 3: account_id tool argument (model supplied).
		if (providedAccountId) {
			if (this.accounts.some((a) => a.id === providedAccountId)) {
				return { accountId: providedAccountId }
			}
			return {
				error: this.errorResult(
					`Account "${providedAccountId}" is not one of the accounts your credentials can access.`
				),
			}
		}

		// Nothing to go on, and the token spans multiple accounts.
		return {
			error: this.errorResult(
				'account_id is required because your credentials can access multiple Cloudflare accounts. Pass account_id, or set a cf-account-id header in your MCP client configuration.'
			),
		}
	}

	/**
	 * Account-list block appended to a server's `initialize` instructions for multi-account
	 * tokens (empty string otherwise). Lets a user discover their account IDs without a tool call.
	 */
	instructionsSuffix(): string {
		if (!this.requiresAccountSelection) {
			return ''
		}
		const list = this.accounts.map((a) => `  - ${a.name} (${a.id})`).join('\n')
		return `\n\n## Your Cloudflare accounts\nYour credentials can access multiple accounts. Pass \`account_id\` to any account-scoped tool to choose one:\n${list}\n\nTo avoid passing \`account_id\` on every call, set a \`cf-account-id\` header to one of the IDs above in your MCP client configuration.`
	}

	private errorResult(message: string): CallToolResult {
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						error: message,
						available_accounts: this.accounts.map((a) => ({ id: a.id, name: a.name })),
					}),
				},
			],
			isError: true,
		}
	}
}
