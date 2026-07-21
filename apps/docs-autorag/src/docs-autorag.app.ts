import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'

import { registerDocsTools } from './tools/docs-autorag.tools'

import type { Env } from './docs-autorag.context'

const app = createPublicMcpApp<Env>({
	serviceHostnames: ['docs-autorag-staging.mcp.cloudflare.com', 'docs-autorag.mcp.cloudflare.com'],
	register: registerDocsTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
