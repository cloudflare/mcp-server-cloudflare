import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { env } from 'cloudflare:workers'

import {
	CloudflareAuthHandler,
	handleTokenExchangeCallback,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'

import { ContainerManager } from './containerManager'
import { ContainerMcpAgent } from './containerMcp'

import type { AccountSchema, UserSchema } from '@repo/mcp-common/src/cloudflare-oauth-handler'

export { ContainerManager, ContainerMcpAgent }

export type Env = {
	CONTAINER_MCP_AGENT: DurableObjectNamespace<ContainerMcpAgent>
	CONTAINER_MANAGER: DurableObjectNamespace<ContainerManager>
	ENVIRONMENT: 'dev' | 'prod'
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
}

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

export default new OAuthProvider({
	apiRoute: '/sse',
	// @ts-ignore
	apiHandler: ContainerMcpAgent.mount('/sse', { binding: 'CONTAINER_MCP_AGENT' }),
	// @ts-ignore
	defaultHandler: CloudflareAuthHandler,
	authorizeEndpoint: '/oauth/authorize',
	tokenEndpoint: '/token',
	tokenExchangeCallback: (options) =>
		handleTokenExchangeCallback(options, env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET),
	// Cloudflare access token TTL
	accessTokenTTL: 3600,
	clientRegistrationEndpoint: '/register',
})
