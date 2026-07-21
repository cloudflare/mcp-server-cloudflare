import { createPublicMcpApp } from '@repo/mcp-common/src/mcp-app'

import { registerBlogTools } from './tools/blog.tools'

import type { Env } from './cloudflare-blog.context'

const app = createPublicMcpApp<Env>({
	serviceHostnames: ['blog-staging.mcp.cloudflare.com', 'blog.mcp.cloudflare.com'],
	register: registerBlogTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
