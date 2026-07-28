import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { registerPrompts } from '@repo/mcp-common/src/shared-prompts/docs-ai-search.prompts'
import { registerDocsTools } from '@repo/mcp-common/src/shared-tools/docs-ai-search.tools'

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
