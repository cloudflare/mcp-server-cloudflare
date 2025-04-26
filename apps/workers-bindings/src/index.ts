import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { registerD1Tools } from '@repo/mcp-common/src/tools/d1'
import { registerKVTools } from '@repo/mcp-common/src/tools/kv_namespace'
import { registerR2BucketTools } from '@repo/mcp-common/src/tools/r2_bucket'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker'
import { MetricsTracker } from '@repo/mcp-observability'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

export type WorkersBindingsMCPState = { activeAccountId: string | null }

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

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
	}
	getActiveAccountId() {
		// TODO: Figure out why this fail sometimes, and why we need to wrap this in a try catch
		try {
			return this.state.activeAccountId ?? null
		} catch (e) {
			return null
		}
	}

	setActiveAccountId(accountId: string) {
		// TODO: Figure out why this fail sometimes, and why we need to wrap this in a try catch
		try {
			this.setState({
				...this.state,
				activeAccountId: accountId,
			})
		} catch (e) {
			return null
		}
	}
}

const BindingsScopes = {
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'user:read': 'See your user info such as name, email address, and account memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_observability:read': 'See observability logs for your account',
	'd1:write': 'Create, read, and write to D1 databases',
	offline_access: 'Grants refresh tokens for long-lived access.',
} as const

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: '/sse',
	// @ts-ignore
	apiHandler: WorkersBindingsMCP.mount('/sse'),
	// @ts-ignore
	defaultHandler: createAuthHandlers({ scopes: BindingsScopes, metrics }),
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: (options) =>
		handleTokenExchangeCallback(options, env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET),
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
