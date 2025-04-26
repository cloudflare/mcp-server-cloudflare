import OAuthProvider from '@cloudflare/workers-oauth-provider'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { MetricsTracker } from '@repo/mcp-observability'

import { ContainerManager } from './containerManager'
import { ContainerMcpAgent } from './containerMcp'

import type { McpAgent } from 'agents/mcp'
import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './context'

export { ContainerManager, ContainerMcpAgent }

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

const ContainerScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:write':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
} as const

export default {
	fetch: (req: Request, env: Env, ctx: ExecutionContext) => {
		// @ts-ignore
		if (env.ENVIRONMENT === 'test') {
			ctx.props = {
				accessToken: 'foobar',
				user: {
					id: '123def',
					email: '1@example.com',
				},
				accounts: [],
			} as Props
			return ContainerMcpAgent.mount('/sse', { binding: 'CONTAINER_MCP_AGENT' }).fetch(
				req,
				env as Record<string, DurableObjectNamespace<McpAgent> | any>,
				ctx
			)
		}

		return new OAuthProvider({
			apiRoute: '/sse',
			apiHandler: ContainerMcpAgent.mount('/sse', { binding: 'CONTAINER_MCP_AGENT' }),
			// @ts-ignore
			defaultHandler: createAuthHandlers({ scopes: ContainerScopes, metrics }),
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
} /*
	
*/
