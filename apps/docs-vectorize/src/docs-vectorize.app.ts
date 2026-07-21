import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-vectorize.prompts'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-vectorize.tools'

import type { Env } from './docs-vectorize.context'

const app = createPublicMcpApp<Env>({
	serviceHostnames: [
		'docs-vectorize-staging.mcp.cloudflare.com',
		'docs-vectorize.mcp.cloudflare.com',
	],
	createSentry: ({ env, executionCtx, request }) => initSentry(env, executionCtx, request),
	register(context) {
		registerDocsTools(context)
		registerPrompts(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
