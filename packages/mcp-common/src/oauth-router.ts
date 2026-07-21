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

export interface CreateCloudflareOAuthRouterOptions<Env extends CloudflareOAuthEnv> {
	apiHandler: RequestHandler<Env>
	scopes: Record<string, string>
	metrics: MetricsTracker
	/** MCP Host/Origin policy enforced before the OAuth Provider handles `/mcp`. */
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
 * Routes OAuth grants, API-token validation, and `/mcp` through one stateless API
 * handler. OAuth grants and KV remain durable application/security state; only MCP
 * protocol sessions are removed.
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
			if (new URL(request.url).pathname === '/mcp') {
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
				apiRoute: '/mcp',
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
