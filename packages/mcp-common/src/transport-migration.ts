/** The one MCP endpoint every server exposes. */
export const MCP_ROUTE = '/mcp'

/** The retired URL: once the HTTP+SSE transport, then a Streamable HTTP alias of `/mcp`. */
const RETIRED_SSE_ROUTE = '/sse'

const MIGRATION_DOCUMENTATION =
	'https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/'

/** The OAuth protected resource for the MCP endpoint on this request's origin. */
export function mcpResource(requestUrl: string): string {
	return new URL(MCP_ROUTE, requestUrl).href
}

export function isRetiredSseRequest(request: Request): boolean {
	return new URL(request.url).pathname === RETIRED_SSE_ROUTE
}

/**
 * Every request to `/sse` gets a `410 Gone` Problem Details response naming the `/mcp` URL.
 *
 * Not a redirect: MCP SDK clients that follow one to `/mcp` with OAuth then refuse the
 * `/mcp` protected resource metadata ("does not match expected …/sse"), an error that never
 * mentions the new URL. MCP SDK v1 and v2 both put this body in the error they raise.
 */
export function retiredSseResponse(request: Request): Response {
	const replacementUrl = new URL(request.url)
	replacementUrl.pathname = MCP_ROUTE
	const replacement = replacementUrl.href

	return new Response(
		JSON.stringify({
			type: MIGRATION_DOCUMENTATION,
			title: 'This MCP URL has moved to /mcp',
			status: 410,
			detail: `The /sse URL is no longer served. Update your MCP client configuration to ${replacement}.`,
			url: replacement,
		}),
		{
			status: 410,
			statusText: 'Gone',
			headers: {
				'Cache-Control': 'no-store',
				'Content-Type': 'application/problem+json',
				Link: `<${replacement}>; rel="alternate"`,
			},
		}
	)
}
