import type { McpRegistrationContext } from '../request-context'

/**
 * Registers developer-platform-related prompts with one request-scoped server.
 */
export function registerPrompts<Env>(context: McpRegistrationContext<Env>) {
	context.server.registerPrompt(
		'workers-prompt-full',
		{
			description:
				'Detailed prompt for generating Cloudflare Workers code (and other developer platform products) from https://developers.cloudflare.com/workers/prompt.txt',
		},
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
