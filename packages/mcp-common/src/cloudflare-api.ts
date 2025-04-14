import { Cloudflare } from 'cloudflare'

import type { z } from 'zod'

export function getCloudflareClient(apiToken: string) {
	return new Cloudflare({ apiToken })
}

/**
 * Makes a request to the Cloudflare API
 * @param endpoint API endpoint path (without the base URL)
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 * @param options Additional fetch options
 * @returns The API response
 */
export async function fetchCloudflareApi<T>({
	endpoint,
	accountId,
	apiToken,
	responseSchema,
	options = {},
}: {
	endpoint: string
	accountId: string
	apiToken: string
	responseSchema?: z.ZodType<T>
	options?: RequestInit
}): Promise<T> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${endpoint}`

	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${apiToken}`,
			...(options.headers || {}),
		},
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`Cloudflare API request failed: ${error}`)
	}

	const data = await response.json()

	// If a schema is provided, validate the response
	if (responseSchema) {
		return responseSchema.parse(data)
	}

	return data as T
}
