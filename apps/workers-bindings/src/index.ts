import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { handleDevMode } from '@repo/mcp-common/src/dev-mode'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { registerD1Tools } from '@repo/mcp-common/src/tools/d1'
import { registerHyperdriveTools } from '@repo/mcp-common/src/tools/hyperdrive'
import { registerKVTools } from '@repo/mcp-common/src/tools/kv_namespace'
import { registerR2BucketTools } from '@repo/mcp-common/src/tools/r2_bucket'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker'
import { MetricsTracker } from '@repo/mcp-observability'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

export { UserDetails }

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

export type WorkersBindingsMCPState = { activeAccountId: string | null }

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps

export class WorkersBindingsMCP extends McpAgent<Env, WorkersBindingsMCPState, Props> {
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

	initialState: WorkersBindingsMCPState = {
		activeAccountId: null,
	}

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
	}

	async init() {
		this.server = new CloudflareMCPServer({
			userId: this.props.user.id,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
		})

		registerAccountTools(this)
		registerKVTools(this)
		registerWorkersTools(this)
		registerR2BucketTools(this)
		registerD1Tools(this)
		registerHyperdriveTools(this)
	}

	async getActiveAccountId() {
		try {
			// Get UserDetails Durable Object based off the userId and retrieve the activeAccountId from it
			// we do this so we can persist activeAccountId across sessions
			const userDetails = getUserDetails(env, this.props.user.id)
			return await userDetails.getActiveAccountId()
		} catch (e) {
			this.server.recordError(e)
			return null
		}
	}

	async setActiveAccountId(accountId: string) {
		try {
			const userDetails = getUserDetails(env, this.props.user.id)
			await userDetails.setActiveAccountId(accountId)
		} catch (e) {
			this.server.recordError(e)
		}
	}
}

const BindingsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'd1:write': 'Create, read, and write to D1 databases',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (
			(env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'test') &&
			env.DEV_DISABLE_OAUTH === 'true'
		) {
			return await handleDevMode(WorkersBindingsMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': WorkersBindingsMCP.serve('/mcp'),
				'/sse': WorkersBindingsMCP.serveSSE('/sse'),
			},
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: BindingsScopes, metrics }),
			authorizeEndpoint: '/oauth/authorize',
			tokenEndpoint: '/token',
			tokenExchangeCallback: (options) =>
				handleTokenExchangeCallback(
					options,
					env.CLOUDFLARE_CLIENT_ID,
					env.CLOUDFLARE_CLIENT_SECRET
				),
			// Cloudflare access token TTL
			accessTokenTTL: 3600,
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
