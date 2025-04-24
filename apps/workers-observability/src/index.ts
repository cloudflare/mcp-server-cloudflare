import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { env } from 'cloudflare:workers'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker'

import { registerLogsTools } from './tools/logs'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { MetricsTracker } from "@repo/mcp-observability"
import { CloudflareMCPServer } from "@repo/mcp-common/src/server"

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export type State = { activeAccountId: string | null }

export class ObservabilityMCP extends McpAgent<Env, State, Props> {
	server: CloudflareMCPServer

	initialState: State = {
		activeAccountId: null,
	}

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.server = new CloudflareMCPServer(this.props.user.id, this.env.MCP_METRICS, {
			name: this.env.MCP_SERVER_NAME,
			version: this.env.MCP_SERVER_VERSION,
		})
	}

	async init() {
		registerAccountTools(this)

		// Register Cloudflare Workers tools
		registerWorkersTools(this)

		// Register Cloudflare Workers logs tools
		registerLogsTools(this)
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

const ObservabilityScopes = {
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'user:read': 'See your user info such as name, email address, and account memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_observability:read': 'See observability logs for your account',
	offline_access: 'Grants refresh tokens for long-lived access.',
} as const

export default new OAuthProvider({
	apiRoute: '/sse',
	// @ts-ignore
	apiHandler: ObservabilityMCP.mount('/sse'),
	// @ts-ignore
	defaultHandler: createAuthHandlers({ scopes: ObservabilityScopes, metrics }),
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: (options) =>
		handleTokenExchangeCallback(options, env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET),
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
