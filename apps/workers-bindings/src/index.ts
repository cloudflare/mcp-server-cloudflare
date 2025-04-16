import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { env } from 'cloudflare:workers'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnvironment } from '@repo/mcp-common/src/config'
import { registerAccountTools } from '@repo/mcp-common/src/tools/account'
import { registerKVTools } from '@repo/mcp-common/src/tools/kv_namespace'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'

export type WorkersBindingsMCPState = { activeAccountId: string | null }

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export class WorkersBindingsMCP extends McpAgent<Env, WorkersBindingsMCPState, Props> {
	server = new McpServer({
		name: 'Demo',
		version: '1.0.0',
	})

	initialState: WorkersBindingsMCPState = {
		activeAccountId: null,
	}

	async init() {
		registerAccountTools(this)
		registerKVTools(this)
		registerWorkersTools(this)
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

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: '/workers/bindings/sse',
	// @ts-ignore
	apiHandler: WorkersBindingsMCP.mount('/workers/bindings/sse'),
	// @ts-ignore
	defaultHandler: createAuthHandlers({
		serverPath: 'workers/containers',
		environment: getEnvironment(env.ENVIRONMENT),
	}),
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
})
