import OAuthProvider from '@cloudflare/workers-oauth-provider'

import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { handleApiTokenMode, isApiTokenRequest } from '@repo/mcp-common/src/api-token-mode'
import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnv } from '@repo/mcp-common/src/env'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { MetricsTracker } from '@repo/mcp-observability'

import { ContainerManager } from './containerManager'
import { ContainerMcpAgent } from './containerMcp'
import { UserContainer } from './userContainer'

import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { Env } from './sandbox.server.context'

export { ContainerManager, ContainerMcpAgent, UserContainer }

const env = getEnv<Env>()

const metrics = new MetricsTracker(env.MCP_METRICS, {
	name: env.MCP_SERVER_NAME,
	version: env.MCP_SERVER_VERSION,
})

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = AuthProps

const ContainerScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
} as const

export default {
	fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
		if (await isApiTokenRequest(req, env)) {
			return await handleApiTokenMode(ContainerMcpAgent, req, env, ctx)
		}

		return new OAuthProvider({
			apiRoute: ['/mcp', '/sse'],
			apiHandler: createApiHandler(ContainerMcpAgent),
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
}
