import type { Cloudflare } from 'cloudflare'

export interface ZoneListParams {
	client: Cloudflare
	accountId: string
	page?: number
	perPage?: number
	direction?: 'asc' | 'desc'
	match?: 'any' | 'all'
	name?: string
	status?: string
	order?: string
}

/**
 * Lists zones under a Cloudflare account
 * @see https://developers.cloudflare.com/api/resources/zones/methods/list/
 */
export async function handleZonesList({
	client,
	accountId,
	page = 1,
	perPage = 50,
	direction = 'desc',
	match = 'all',
	name,
	status,
	order = 'name',
}: ZoneListParams) {
	// Build query parameters
	const query: Record<string, string | number> = {
		page,
		per_page: perPage,
		direction,
		match,
		account_id: accountId,
	}

	// Only add these parameters if they're defined and not empty strings
	if (name) {
		query.name = name
	}

	if (status) {
		query.status = status
	}

	if (order) {
		query.order = order
	}

	try {
		// Use the zones.list method from the Cloudflare client
		const response = await client.zones.list({ query })
		return response.result
	} catch (error) {
		throw new Error(
			`Failed to list zones: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}
