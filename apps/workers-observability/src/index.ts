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
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerObservabilityTools } from './tools/observability'

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

export class ObservabilityMCP extends McpAgent<Env, State, Props> {
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

	async init() {
		this.server = new CloudflareMCPServer({
			userId: this.props.user.id,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			sentry: initSentryWithUser(env, this.ctx, this.props.user.id),
			options: {
				instructions: `# Cloudflare Workers Observability Tool

This tool provides powerful capabilities to analyze and troubleshoot your Cloudflare Workers through logs and metrics. Here's how to use it effectively:

## IMPORTANT: Query Discipline

**STOP after the first successful query if it answers the user's question.** Do not run multiple queries unless absolutely necessary. The first query often contains the answer - review it thoroughly before running additional queries.

## Best Practices

### Efficient Querying
- Start with a focused query that's most likely to answer the question
- Review results completely before deciding if additional queries are needed
- If the first query provides the answer, STOP and present it to the user
- Only run additional queries when specifically directed or when essential information is missing

### When to STOP Querying
- STOP after presenting meaningful results from the first query
- STOP when you've answered the user's specific question
- STOP when the user hasn't requested additional exploration
- Only continue if explicitly directed with "EXPLORE" or similar instruction
`,
			},
		})

		registerAccountTools(this)

		// Register Cloudflare Workers tools
		registerWorkersTools(this)

		// Register Cloudflare Workers logs tools
		registerObservabilityTools(this)
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

const ObservabilityScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_observability:read': 'See observability logs for your account',
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
	return ObservabilityMCP.mount('/sse').fetch(req, env, ctx)
}

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (env.ENVIRONMENT === 'development' && env.DEV_DISABLE_OAUTH === 'true') {
			return await handleDevMode(req, env, ctx)
		}

		return new OAuthProvider({
			apiRoute: '/sse',
			apiHandler: ObservabilityMCP.mount('/sse'),
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: ObservabilityScopes, metrics }),
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
