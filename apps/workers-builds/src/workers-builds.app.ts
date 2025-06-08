import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'

import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getUserDetails, UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import { getEnv } from '@repo/mcp-common/src/env'
import { fmt } from '@repo/mcp-common/src/format'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account.tools'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'

import { MetricsTracker } from '../../../packages/mcp-observability/src'
import { registerBuildsTools } from './tools/workers-builds.tools'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './workers-builds.context'

export { UserDetails }

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = AuthProps

type State = {
	activeAccountId: string | null
	activeBuildUUID: string | null
	activeWorkerId: string | null
}

export class BuildsMCP extends McpAgent<Env, State, Props> {
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
				instructions: fmt.trim(`
					# Cloudflare Workers Builds Tool
					* A Cloudflare Worker is a serverless function
					* Workers Builds is a CI/CD system for building and deploying your Worker whenever you push code to GitHub/GitLab.

					This server allows you to view and debug Cloudflare Workers Builds for your Workers (NOT Cloudflare Pages).

					To get started, you can list your accounts (accounts_list) and then set an active account (set_active_account).
					Once you have an active account, you can list your Workers (workers_list) and set an active Worker (workers_builds_set_active_worker).
					You can then list the builds for your Worker (workers_builds_list_builds) and set an active build (workers_builds_set_active_build).
					Once you have an active build, you can view the logs (workers_builds_get_build_logs).
				`),
			},
		})

		registerAccountTools(this)

		// Register Cloudflare Workers tools
		registerWorkersTools(this)

		// Register Cloudflare Workers logs tools
		registerBuildsTools(this)
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

	async getActiveBuildUUID(): Promise<string | null> {
		try {
			return this.state.activeBuildUUID
		} catch (e) {
			this.server.recordError(e)
			return null
		}
	}

	async setActiveBuildUUID(buildUUID: string | null): Promise<void> {
		try {
			this.setState({
				...this.state,
				activeBuildUUID: buildUUID,
			})
		} catch (e) {
			this.server.recordError(e)
		}
	}

	async getActiveWorkerId(): Promise<string | null> {
		try {
			return this.state.activeWorkerId
		} catch (e) {
			this.server.recordError(e)
			return null
		}
	}

	async setActiveWorkerId(workerId: string | null): Promise<void> {
		try {
			this.setState({
				...this.state,
				activeWorkerId: workerId,
			})
		} catch (e) {
			this.server.recordError(e)
		}
	}
}

const BuildsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:read':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_builds:read':
		'See and change Cloudflare Workers Builds data such as builds, build configuration, and logs.',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(BuildsMCP, req, env, ctx)
		}

		return new OAuthProvider({
			apiHandlers: {
				'/mcp': BuildsMCP.serve('/mcp'),
				'/sse': BuildsMCP.serveSSE('/sse'),
			},
			// @ts-expect-error
			defaultHandler: createAuthHandlers({ scopes: BuildsScopes, metrics }),
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
