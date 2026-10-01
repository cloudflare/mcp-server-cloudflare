const USER_AGENT_PRODUCT = 'mcp-server-cloudflare'
const SERVER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

let userAgent = USER_AGENT_PRODUCT

/**
 * Name this Worker's server in the User-Agent: `mcp-server-cloudflare/<serverId>`. The MCP app
 * factories call it once, at module load, so every outbound request carries it.
 */
export function setUserAgentServer(serverId: string): void {
	if (!SERVER_ID_PATTERN.test(serverId)) {
		throw new TypeError(`serverId must be lowercase kebab-case, got ${JSON.stringify(serverId)}`)
	}
	userAgent = `${USER_AGENT_PRODUCT}/${serverId}`
}

/** User-Agent sent on every outbound request to Cloudflare (API, OAuth, docs, blog). */
export function getUserAgent(): string {
	return userAgent
}

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
	headers.set('User-Agent', userAgent)
	return fetch(input, { ...init, headers })
}
