import type { CloudflareMcpAgentNoAccount } from '../types/cloudflare-mcp-agent.types'

/**
 * Registers developer-platform-related prompts with the MCP server
 * @param agent The MCP server instance
 */
export function registerPrompts(agent: CloudflareMcpAgentNoAccount) {
	agent.server.prompt(
		'workers-prompt-full',
		'Detailed prompt for generating Cloudflare Workers code (and other developer platform products) from https://developers.cloudflare.com/workers/prompt.txt',
		async () => ({
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: await (
							await fetch('https://developers.cloudflare.com/workers/prompt.txt', {
								cf: { cacheEverything: true, cacheTtl: 3600 },
							})
						).text(),
					},
				},
			],
		})
	)
}
