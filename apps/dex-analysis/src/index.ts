import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import {
	createAuthHandlers,
	getUserAndAccounts,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerDEXTools } from './tools/dex'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

export { UserDetails }

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export type State = { activeAccountId: string | null }

export class CloudflareDEXMCP extends McpAgent<Env, State, Props> {
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
		this.server = new CloudflareMCPServer({
			userId: this.props.user.id,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
		})

		registerAccountTools(this)
		registerDEXTools(this)
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

const DexScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'dex:read': 'See Cloudflare Cloudflare DEX data for your account',
} as const

// TODO: Move this in to mcp-common
async function handleDevMode(req: Request, env: Env, ctx: ExecutionContext) {
	const { user, accounts } = await getUserAndAccounts(env.DEV_CLOUDFLARE_API_TOKEN, {
		'X-Auth-Email': env.DEV_CLOUDFLARE_EMAIL,
		'X-Auth-Key': env.DEV_CLOUDFLARE_API_TOKEN,
	})
	ctx.props = {
		accessToken: env.DEV_CLOUDFLARE_API_TOKEN,
		user,
		accounts,
	} as Props
	return CloudflareDEXMCP.mount('/sse').fetch(req, env, ctx)
}

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (env.ENVIRONMENT === 'development' && env.DEV_DISABLE_OAUTH === 'true') {
			return await handleDevMode(req, env, ctx)
		}

		return new OAuthProvider({
			apiRoute: '/sse',
			apiHandler: CloudflareDEXMCP.mount('/sse'),
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: DexScopes, metrics }),
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
