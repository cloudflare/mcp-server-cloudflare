import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-ai-search.prompts'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'

import type { Env } from './docs-ai-search.context'

const app = createPublicMcpApp<Env>({
	serviceHostnames: ['docs-staging.mcp.cloudflare.com', 'docs.mcp.cloudflare.com'],
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	register(context) {
		registerDocsTools(context)
		registerPrompts(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
