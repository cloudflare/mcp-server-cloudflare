import { MCPClientManager } from 'agents/mcp/client'

export async function initializeClient(): Promise<MCPClientManager> {
	// This eval client runs outside a Durable Object; storage is only used to persist OAuth
	// state, which an unauthenticated localhost connection never touches, so a stub suffices.
	const clientManager = new MCPClientManager('test-client', '0.0.0', {
		storage: {} as unknown as DurableObjectStorage,
	})
	await clientManager.connect('http://localhost:8977/mcp')
	return clientManager
}
