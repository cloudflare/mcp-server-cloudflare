export function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary)
}

// Used for file related tool calls in case the llm sends a full resource URI
export async function stripProtocolFromFilePath(path: string): Promise<string> {
	return path.startsWith('file://') ? path.replace('file://', '') : path
}

/**
 * Resolve a tool's file path against the container's working directory. A leading `/` is
 * dropped, so `file:///notes.txt` and `notes.txt` name the same file, as they always have.
 */
export function toWorkdirPath(path: string): string {
	return path.replace(/^\/+/, '') || '.'
}
