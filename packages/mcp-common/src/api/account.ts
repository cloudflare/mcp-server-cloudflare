import type { Cloudflare } from 'cloudflare'
import type { Account } from 'cloudflare/resources/accounts/accounts.mjs'

export async function handleAccountsList({ client }: { client: Cloudflare }): Promise<Account[]> {
	// Currently limited to 50 accounts
	const response = await client.accounts.list({ query: { per_page: 50 } })
	return response.result
}
