/** Stable SHA-256 used for optimistic concurrency checks and sync state. */
export async function contentHash(content: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
