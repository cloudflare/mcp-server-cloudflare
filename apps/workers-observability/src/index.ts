import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'

import {
	CloudflareAuthHandler,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'

import { registerAccountTools } from './tools/account'
import { registerLogsTools } from './tools/logs'
import { registerWorkersTools } from './tools/workers'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from '../worker-configuration'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export type State = { activeAccountId: string | null }

export class MyMCP extends McpAgent<Env, State, Props> {
	server = new McpServer({
		name: 'Remote MCP Server with Workers Observability',
		version: '1.0.0',
	})
	// TOOO: Why does this type need to be declared again on MyMCP?
	// @ts-ignore
	env!: Env

	initialState: State = {
		activeAccountId: null,
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

export default new OAuthProvider({
	apiRoute: '/workers/observability/sse',
	// @ts-ignore
	apiHandler: MyMCP.mount('/workers/observability/sse'),
	// @ts-ignore
	defaultHandler: CloudflareAuthHandler,
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: handleTokenExchangeCallback,
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
