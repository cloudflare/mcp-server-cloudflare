export function isBenignDisconnectError(error: unknown): boolean {
	return error instanceof Error && error.message === 'destroyed'
}

export async function handleBenignDisconnect(response: Promise<Response>): Promise<Response> {
	try {
		return await response
	} catch (error) {
		if (isBenignDisconnectError(error)) {
			console.warn('MCP connection closed while request was in flight', error)
			return new Response(null, { status: 499 })
		}
		throw error
	}
}
