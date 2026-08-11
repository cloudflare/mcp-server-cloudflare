const LEGACY_SSE_ROUTE = '/sse'
const MIGRATION_DOCUMENTATION =
	'https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/'

export function isLegacySseStreamRequest(request: Request): boolean {
	return request.method === 'GET' && new URL(request.url).pathname === LEGACY_SSE_ROUTE
}

export function legacySseMigrationResponse(request: Request, canonicalRoute = '/mcp'): Response {
	const current = new URL(request.url).href
	const replacementUrl = new URL(request.url)
	replacementUrl.pathname = canonicalRoute
	const replacement = replacementUrl.href

	return new Response(
		JSON.stringify({
			type: MIGRATION_DOCUMENTATION,
			title: 'Legacy SSE transport is no longer supported',
			status: 410,
			detail:
				'This URL no longer supports the deprecated HTTP+SSE transport. Configure this URL to use Streamable HTTP, or update to the replacement URL for future compatibility.',
			options: [
				{
					action: 'change-transport',
					transport: 'streamable-http',
					url: current,
					recommended: false,
				},
				{
					action: 'update-url',
					transport: 'streamable-http',
					url: replacement,
					recommended: true,
				},
			],
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
