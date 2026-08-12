import { localhostAllowedHostnames, localhostAllowedOrigins } from '@modelcontextprotocol/server'

import { MetricsTracker } from '@repo/mcp-observability'

import { createCloudflareOAuthRouter } from './oauth-router'
import { createCloudflareMcpHandler } from './server'

import type { CloudflareOAuthEnv } from './oauth-router'
import type { CloudflareMcpHandler, CloudflareMcpServerFactoryOptions } from './server'

const PLAYGROUND_HOSTNAME = 'playground.ai.cloudflare.com'

export interface StandardMcpEnv {
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_METRICS: AnalyticsEngineDataset
}

interface RequestHandler<Env> {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}

export interface CloudflareMcpApp<Env> {
	readonly worker: RequestHandler<Env>
	/** Exposed separately for transport-contract tests that bypass OAuth routing. */
	readonly mcpHandler: CloudflareMcpHandler<Env>
}

type ServerAssemblyOptions<Env> = Pick<
	CloudflareMcpServerFactoryOptions<Env>,
	'register' | 'serverOptions' | 'createSentry'
>

export type CreatePublicMcpAppOptions<Env> = ServerAssemblyOptions<Env> & {
	/** Staging and production service hostnames; localhost policy is added centrally. */
	serviceHostnames: readonly string[]
}

export type CreateAuthenticatedMcpAppOptions<Env> = CreatePublicMcpAppOptions<Env> & {
	scopes: Record<string, string>
}

interface McpAppFoundation<Env> {
	mcpHandler: CloudflareMcpHandler<Env>
	mcpRequestPolicy: {
		allowedHostnames: string[]
		allowedOriginHostnames: string[]
	}
}

/** Creates a public stateless MCP Worker with the canonical metadata, metrics, and HTTP policy. */
export function createPublicMcpApp<Env extends StandardMcpEnv>(
	options: CreatePublicMcpAppOptions<Env>
): CloudflareMcpApp<Env> {
	const foundation = createMcpAppFoundation(options, false)
	return {
		mcpHandler: foundation.mcpHandler,
		worker: foundation.mcpHandler,
	}
}

/**
 * Creates an authenticated stateless MCP Worker with canonical OAuth/API-token
 * routing, metadata, metrics, and HTTP policy.
 */
export function createAuthenticatedMcpApp<Env extends StandardMcpEnv & CloudflareOAuthEnv>(
	options: CreateAuthenticatedMcpAppOptions<Env>
): CloudflareMcpApp<Env> {
	const { scopes, ...serverOptions } = options
	const foundation = createMcpAppFoundation(serverOptions, true)

	return {
		mcpHandler: foundation.mcpHandler,
		worker: {
			fetch(request, env, ctx) {
				const metrics = new MetricsTracker(env.MCP_METRICS, serverInfo(env))
				return createCloudflareOAuthRouter({
					apiHandler: foundation.mcpHandler,
					scopes,
					metrics,
					mcpRequestPolicy: foundation.mcpRequestPolicy,
				}).fetch(request, env, ctx)
			},
		},
	}
}

function createMcpAppFoundation<Env extends StandardMcpEnv>(
	{ serviceHostnames, ...serverOptions }: CreatePublicMcpAppOptions<Env>,
	requireAuth: boolean
): McpAppFoundation<Env> {
	const mcpRequestPolicy = {
		allowedHostnames: [...localhostAllowedHostnames(), ...serviceHostnames],
		allowedOriginHostnames: [
			...localhostAllowedOrigins(),
			...serviceHostnames,
			PLAYGROUND_HOSTNAME,
		],
	}
	const mcpHandler = createCloudflareMcpHandler<Env>({
		...serverOptions,
		serverInfo: ({ env }) => serverInfo(env),
		requireAuth,
		createMetrics: ({ env }, info) => new MetricsTracker(env.MCP_METRICS, info),
		handler: mcpRequestPolicy,
	})

	return { mcpHandler, mcpRequestPolicy }
}

function serverInfo(env: StandardMcpEnv) {
	return {
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}
}
