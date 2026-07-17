import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { AccountManager } from '@repo/mcp-common/src/account-manager'
import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { getProps } from '@repo/mcp-common/src/get-props'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerMemoryTools } from './server'
import { userIdFromProps } from './user-context'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './agent-memory.context'

// Re-export the search-index Durable Object so wrangler can bind it.
export { MemoryIndex } from './search/durable-object'

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

export type AgentMemoryMCPState = Record<string, never>

type Props = AuthProps

export class AgentMemoryMCP extends McpAgent<Env, AgentMemoryMCPState, Props> {
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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
	}

	async init() {
		const props = getProps(this)
		const userId = userIdFromProps(props)
		const accountManager = new AccountManager(props)

		this.server = new CloudflareMCPServer({
			userId,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			accountManager,
			options: { instructions: instructions(accountManager.instructionsSuffix()) },
		})

		registerMemoryTools(this, this.env)
	}
}

function instructions(accountSuffix: string): string {
	return `Agent Memory — persistent, semantically-searchable memory for AI agents.

Store markdown notes, patterns, and learnings; retrieve them by meaning with
\`search\`. Files live in an R2 bucket in *your own* Cloudflare account and
embeddings run on *your* Workers AI, so all storage and AI spend is billed to
you. The optional \`run_reflection\` tool uses an LLM to tidy and consolidate
your memory; it is opt-out via \`set_config\`.${accountSuffix}`
}

// R2 object storage + Workers AI both run in the user's account via the
// Cloudflare REST API, so we request the scopes that grant them.
const AgentMemoryScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes (used for R2 object storage).',
	'ai:write':
		'See and change Workers AI catalog and assets (used to generate embeddings + reflections).',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(AgentMemoryMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': AgentMemoryMCP.serve('/mcp'),
				'/sse': AgentMemoryMCP.serveSSE('/sse'),
			},
			defaultHandler: createAuthHandlers({ scopes: AgentMemoryScopes, metrics }),
			authorizeEndpoint: '/oauth/authorize',
			tokenEndpoint: '/token',
			tokenExchangeCallback: (options) =>
				handleTokenExchangeCallback(
					options,
					env.CLOUDFLARE_CLIENT_ID,
					env.CLOUDFLARE_CLIENT_SECRET
				),
			accessTokenTTL: 3600,
			refreshTokenTTL: 2592000,
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
