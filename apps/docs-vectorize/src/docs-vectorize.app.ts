import { McpAgent } from 'agents/mcp'

import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-vectorize.prompts'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-vectorize.tools'

import type { Env } from './docs-vectorize.context'

const env = getEnv<Env>()

// The docs MCP server isn't stateful, so we don't have state/props
export type Props = never

export type State = never

export class CloudflareDocumentationMCP extends McpAgent<Env, State, Props> {
	server = new CloudflareMCPServer({
		wae: env.MCP_METRICS,
		serverInfo: {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		},
	})

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		super(ctx, env)
	}

	async init() {
		registerDocsTools(this, this.env)
		registerPrompts(this)
	}
}

export default createApiHandler(CloudflareDocumentationMCP)
