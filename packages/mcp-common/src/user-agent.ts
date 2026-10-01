/** User-Agent sent on every outbound request to Cloudflare (API, OAuth, docs, blog). */
export const USER_AGENT = 'mcp-server-cloudflare'

/**
 * `fetch` with our User-Agent. Use it for every outbound request to Cloudflare so the
 * traffic is attributable. A caller-supplied User-Agent is overwritten.
 */
export function cloudflareFetch(
	input: RequestInfo | URL,
	init?: RequestInit<RequestInitCfProperties>
): Promise<Response> {
	// Without init headers, start from the Request's own: init.headers would otherwise replace them.
	const headers = new Headers(
		init?.headers ?? (input instanceof Request ? input.headers : undefined)
	)
	headers.set('User-Agent', USER_AGENT)
	return fetch(input, { ...init, headers })
}
