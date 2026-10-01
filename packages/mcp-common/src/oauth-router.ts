import OAuthProvider from '@cloudflare/workers-oauth-provider'
import {
	hostHeaderValidationResponse,
	originValidationResponse,
} from '@modelcontextprotocol/server'

import {
	devApiTokenModeEnabled,
	handleDevApiTokenMode,
	resolveExternalToken,
} from './api-token-mode'
import { createAuthHandlers, handleTokenExchangeCallback } from './cloudflare-oauth-handler'
import { isRetiredSseRequest, MCP_ROUTE, mcpResource } from './transport-migration'

import type { OAuthProviderOptions } from '@cloudflare/workers-oauth-provider'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { RequestHandler } from './api-token-mode'

export interface CloudflareOAuthEnv extends Cloudflare.Env {
	OAUTH_KV: KVNamespace
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

export interface CreateCloudflareOAuthRouterOptions<Env extends CloudflareOAuthEnv> {
	apiHandler: RequestHandler<Env>
	scopes: Record<string, string>
	metrics: MetricsTracker
	/** MCP Host/Origin policy enforced before the OAuth Provider handles either MCP URL. */
	mcpRequestPolicy: {
		allowedHostnames: string[]
		allowedOriginHostnames: string[]
	}
	provider?: Omit<
		OAuthProviderOptions<Env>,
		| 'apiRoute'
		| 'apiHandler'
		| 'apiHandlers'
		| 'defaultHandler'
		| 'authorizeEndpoint'
		| 'tokenEndpoint'
		| 'tokenExchangeCallback'
		| 'resolveExternalToken'
		| 'resourceMetadata'
	>
}

/**
 * Routes OAuth grants and API-token validation to the stateless `/mcp` handler. The OAuth
 * protected resource is `<origin>/mcp`: every token is bound to it. The retired `/sse` URL
 * goes straight to the handler, which points it at `/mcp`.
 */
export function createCloudflareOAuthRouter<Env extends CloudflareOAuthEnv>({
	apiHandler,
	scopes,
	metrics,
	mcpRequestPolicy,
	provider,
}: CreateCloudflareOAuthRouterOptions<Env>): RequestHandler<Env> {
	const defaultHandler = createAuthHandlers({ scopes, metrics })
	return {
		async fetch(request, env, ctx) {
			// Before OAuth: a client still configured with /sse must see where to go, not a 401.
			if (isRetiredSseRequest(request)) return apiHandler.fetch(request, env, ctx)

			if (new URL(request.url).pathname === MCP_ROUTE) {
				const hostRejection = hostHeaderValidationResponse(
					request,
					mcpRequestPolicy.allowedHostnames
				)
				const originRejection = originValidationResponse(
					request,
					mcpRequestPolicy.allowedOriginHostnames
				)
				if (hostRejection || originRejection) {
					return apiHandler.fetch(request, env, ctx)
				}

				// Let the MCP handler own browser preflight so its exact CORS policy is preserved.
				if (request.method === 'OPTIONS') {
					return apiHandler.fetch(request, env, ctx)
				}
			}

			if (devApiTokenModeEnabled(env)) {
				return handleDevApiTokenMode(apiHandler, request, env, ctx)
			}

			return new OAuthProvider<Env>({
				clientRegistrationEndpoint: '/register',
				accessTokenTTL: 3600,
				refreshTokenTTL: 2_592_000,
				...provider,
				apiRoute: MCP_ROUTE,
				apiHandler,
				// One canonical resource per origin: tokens are bound to `<origin>/mcp`.
				resourceMetadata: { resource: mcpResource(request.url) },
				defaultHandler,
				authorizeEndpoint: '/oauth/authorize',
				tokenEndpoint: '/token',
				// The provider resolves its own access tokens first, then delegates
				// direct Cloudflare API/OAuth credentials to resolveExternalToken.
				resolveExternalToken,
				// An upstream invalid_grant thrown here revokes the grant (workers-oauth-provider 1.1+).
				tokenExchangeCallback: (options) =>
					handleTokenExchangeCallback(
						options,
						options.env.CLOUDFLARE_CLIENT_ID,
						options.env.CLOUDFLARE_CLIENT_SECRET
					),
			}).fetch(request, env, ctx)
		},
	}
}
