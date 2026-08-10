import OAuthProvider from '@cloudflare/workers-oauth-provider'
import {
	hostHeaderValidationResponse,
	originValidationResponse,
} from '@modelcontextprotocol/server'

import { handleApiTokenMode, isApiTokenRequest } from './api-token-mode'
import { createAuthHandlers, handleTokenExchangeCallback } from './cloudflare-oauth-handler'

import type { OAuthProviderOptions } from '@cloudflare/workers-oauth-provider'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { RequestHandler } from './api-token-mode'

export interface CloudflareOAuthEnv extends Cloudflare.Env {
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
	DEV_DISABLE_OAUTH: string
}

const MCP_ROUTES = ['/mcp', '/sse']

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
		| 'resourceMatchOriginOnly'
	>
}

/**
 * Routes OAuth grants, API-token validation, and both MCP URLs through one
 * stateless API handler. `/sse` is only a URL alias for the same Streamable HTTP
 * handler as `/mcp`; OAuth grants and KV remain durable application/security state.
 */
export function createCloudflareOAuthRouter<Env extends CloudflareOAuthEnv>({
	apiHandler,
	scopes,
	metrics,
	mcpRequestPolicy,
	provider,
}: CreateCloudflareOAuthRouterOptions<Env>): RequestHandler<Env> {
	if (provider && 'resourceMatchOriginOnly' in provider) {
		throw new TypeError(
			'resourceMatchOriginOnly is no longer supported; OAuth resources must match exactly'
		)
	}
	const defaultHandler = createAuthHandlers({ scopes, metrics })
	return {
		async fetch(request, env, ctx) {
			if (MCP_ROUTES.includes(new URL(request.url).pathname)) {
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

				// Let the MCP handler own its browser preflight so the exact policy and
				// modern request-header allowlist are not replaced by the OAuth Provider's
				// intentionally broad discovery-endpoint CORS response.
				if (request.method === 'OPTIONS') return apiHandler.fetch(request, env, ctx)
			}

			if (await isApiTokenRequest(request, env)) {
				return handleApiTokenMode(apiHandler, request, env, ctx)
			}

			return new OAuthProvider<Env>({
				clientRegistrationEndpoint: '/register',
				accessTokenTTL: 3600,
				refreshTokenTTL: 2_592_000,
				...provider,
				apiRoute: MCP_ROUTES,
				apiHandler,
				defaultHandler,
				authorizeEndpoint: '/oauth/authorize',
				tokenEndpoint: '/token',
				tokenExchangeCallback: (options) =>
					handleTokenExchangeCallback(
						options,
						env.CLOUDFLARE_CLIENT_ID,
						env.CLOUDFLARE_CLIENT_SECRET
					),
			}).fetch(request, env, ctx)
		},
	}
}
