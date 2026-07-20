import { createApiHandler } from '@repo/mcp-common/src/api-handler'
import { fmt } from '@repo/mcp-common/src/format'
import { createCloudflareOAuthRouter } from '@repo/mcp-common/src/oauth-router'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'
import { MetricsTracker } from '@repo/mcp-observability'

import { registerBuildsTools } from './tools/workers-builds.tools'

import type { Env } from './workers-builds.context'

export const BUILDS_INSTRUCTIONS = fmt.trim(`
	# Cloudflare Workers Builds Tool
	* A Cloudflare Worker is a serverless function.
	* Workers Builds is a CI/CD system for building and deploying your Worker whenever you push code to GitHub or GitLab.

	This server lets you view and debug Cloudflare Workers Builds for Workers (not Cloudflare Pages).

	Start by listing Workers with workers_list. Pass the selected Worker's ID explicitly as workerId to workers_builds_list_builds. Pass a build UUID explicitly to workers_builds_get_build or workers_builds_get_build_logs.
`)

const BuildsScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'workers:read':
		'See and change Cloudflare Workers data such as zones, KV storage, namespaces, scripts, and routes.',
	'workers_builds:read':
		'See and change Cloudflare Workers Builds data such as builds, build configuration, and logs.',
} as const

const allowedHostnames = [
	'localhost',
	'127.0.0.1',
	'[::1]',
	'builds-staging.mcp.cloudflare.com',
	'builds.mcp.cloudflare.com',
]
const mcpRequestPolicy = {
	allowedHostnames,
	allowedOriginHostnames: [...allowedHostnames, 'playground.ai.cloudflare.com'],
}

export const mcpHandler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	requireAuth: true,
	serverOptions: { instructions: BUILDS_INSTRUCTIONS },
	createSentry: ({ env, executionCtx, request, props }) =>
		props?.type === 'user_token'
			? initSentryWithUser(env, executionCtx, props.user.id, request)
			: undefined,
	createMetrics: ({ env }, serverInfo) => new MetricsTracker(env.MCP_METRICS, serverInfo),
	register(context) {
		registerWorkersTools(context)
		registerBuildsTools(context)
	},
	handler: mcpRequestPolicy,
})

const apiHandler = createApiHandler(mcpHandler)

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const metrics = new MetricsTracker(env.MCP_METRICS, {
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		})
		return createCloudflareOAuthRouter({
			apiHandler,
			scopes: BuildsScopes,
			metrics,
			mcpRequestPolicy,
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
