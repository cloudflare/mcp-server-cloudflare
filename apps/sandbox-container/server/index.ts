import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { env } from 'cloudflare:workers'

import {
	createAuthHandlers,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { getEnvironment } from '@repo/mcp-common/src/config'

import { ContainerManager } from './containerManager'
import { ContainerMcpAgent } from './containerMcp'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'

export { ContainerManager, ContainerMcpAgent }

export type Env = {
	CONTAINER_MCP_AGENT: DurableObjectNamespace<ContainerMcpAgent>
	CONTAINER_MANAGER: DurableObjectNamespace<ContainerManager>
	ENVIRONMENT: 'dev' | 'prod'
}

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export default new OAuthProvider({
	apiRoute: '/workers/sandbox/sse',
	// @ts-ignore
	apiHandler: ContainerMcpAgent.mount('/workers/sandbox/sse', { binding: 'CONTAINER_MCP_AGENT' }),
	// @ts-ignore
	defaultHandler: createAuthHandlers({
		serverPath: 'workers/containers',
		environment: getEnvironment(env.ENVIRONMENT),
	}),
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: (options) =>
		handleTokenExchangeCallback(options, env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET),
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
