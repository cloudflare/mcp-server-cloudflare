import { MCPClientManager } from 'agents/mcp/client'

export async function initializeClient(): Promise<MCPClientManager> {
	const clientManager = new MCPClientManager('test-client', '0.0.0', {
		storage: {} as unknown as DurableObjectStorage,
	})
	await clientManager.connect('http://localhost:8977/mcp')
	return clientManager
}
