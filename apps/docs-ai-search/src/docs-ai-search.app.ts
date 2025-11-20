import { McpAgent } from 'agents/mcp'

import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { registerPrompts } from '@repo/mcp-common/src/prompts/docs-vectorize.prompts'
import { initSentry } from '@repo/mcp-common/src/sentry'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerDocsTools } from '@repo/mcp-common/src/tools/docs-ai-search.tools'

import type { Env } from './docs-ai-search.context'

const env = getEnv<Env>()

// The docs MCP server isn't stateful, so we don't have state/props
export type Props = never

export type State = never

export class CloudflareDocumentationMCP extends McpAgent<Env, State, Props> {
	_server: CloudflareMCPServer | undefined
	set server(server: CloudflareMCPServer) {
		this._server = server
	}
	get server(): CloudflareMCPServer {
		if (!this._server) {
			throw new Error('Tried to access server before it was initialized')
		}

		return this._server
	}

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		super(ctx, env)
	}

	async init() {
		const sentry = initSentry(env, this.ctx)

		this.server = new CloudflareMCPServer({
			wae: env.MCP_METRICS,
			serverInfo: {
				name: env.MCP_SERVER_NAME,
				version: env.MCP_SERVER_VERSION,
			},
			sentry,
		})

		registerDocsTools(this, this.env)
		registerPrompts(this)
	}
}

export default createApiHandler(CloudflareDocumentationMCP)
