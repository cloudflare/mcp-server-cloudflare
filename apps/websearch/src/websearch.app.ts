import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpHandler } from 'agents/mcp'

import { AccountManager } from '@repo/mcp-common/src/account-manager'
import { isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	getUserAndAccounts,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerWebSearchTools } from './tools/websearch.tools'
import { BASE_INSTRUCTIONS } from './websearch.context'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './websearch.context'

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

const WebSearchScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'websearch.run': 'Grants access to run Cloudflare Web Search queries.',
} as const

// Stateless: createMcpHandler needs a fresh server per request. AccountManager + buildAccountTool
// give the same account resolution (auth-pinned → cf-account-id header → account_id arg) the
// McpAgent servers get from CloudflareMCPServer.accountTool().
// TODO(RAG-1300): tool-call metrics are not yet tracked for the stateless server.
function createServer(env: Env, props: AuthProps): McpServer {
	const accountManager = new AccountManager(props)
	const server = new McpServer(
		{ name: env.MCP_SERVER_NAME, version: env.MCP_SERVER_VERSION },
		{ instructions: `${BASE_INSTRUCTIONS}${accountManager.instructionsSuffix()}` }
	)
	registerWebSearchTools(server, accountManager, props.accessToken)
	return server
}

// Stateless streamable-HTTP handler. Reads the AuthProps set by the OAuthProvider (OAuth mode)
// or by the API-token branch below, then builds a fresh server for the request.
function mcpFetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const { props } = ctx as { props: AuthProps }
	const handler = createMcpHandler(createServer(env, props), { route: '/mcp' })
	return handler(req, env, ctx)
}

// Resolve a raw Cloudflare API token into the same AuthProps shape the OAuth flow produces, so
// AccountManager can pin/validate the account (mirrors mcp-common's handleApiTokenMode).
async function buildApiTokenProps(req: Request, env: Env): Promise<AuthProps> {
	let devModeHeaders: HeadersInit | undefined
	let token: string
	if (env.DEV_CLOUDFLARE_API_TOKEN && env.DEV_DISABLE_OAUTH === 'true') {
		devModeHeaders = { Authorization: `Bearer ${env.DEV_CLOUDFLARE_API_TOKEN}` }
		token = env.DEV_CLOUDFLARE_API_TOKEN
	} else {
		const [, bearer] = (req.headers.get('Authorization') ?? '').split(' ')
		token = bearer ?? ''
	}

	const { user, accounts } = await getUserAndAccounts(token, devModeHeaders)
	if (user === null) {
		return { type: 'account_token', accessToken: token, account: accounts[0] }
	}
	return { type: 'user_token', accessToken: token, user, accounts }
}

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
		// Raw Cloudflare API token bearer → skip OAuth, use it directly.
		// OAuth-issued tokens are excluded by isApiTokenRequest and fall through.
		if (await isApiTokenRequest(req, env)) {
			// `ExecutionContext.props` is typed readonly, but the handler reads the props we
			// set here before the request is served, so assign through a typed mutable view.
			const ctxWithProps = ctx as { props: AuthProps }
			ctxWithProps.props = await buildApiTokenProps(req, env)
			return mcpFetch(req, env, ctx)
		}

		// OAuth mode: advertises the OAuth endpoints and decrypts OAuth-issued
		// tokens into ctx.props before delegating to the MCP handler.
		return new OAuthProvider({
			apiHandlers: {
				'/mcp': { fetch: mcpFetch },
			},
			defaultHandler: createAuthHandlers({ scopes: WebSearchScopes, metrics }),
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
			refreshTokenTTL: 2592000, // 30 days
			clientRegistrationEndpoint: '/register',
		}).fetch(req, env, ctx)
	},
}
