import { fmt } from '@repo/mcp-common/src/format'
import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { registerWorkersTools } from '@repo/mcp-common/src/tools/worker.tools'

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

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['builds-staging.mcp.cloudflare.com', 'builds.mcp.cloudflare.com'],
	scopes: BuildsScopes,
	serverOptions: { instructions: BUILDS_INSTRUCTIONS },
	createSentry: ({ env, executionCtx, request, props }) =>
		props?.type === 'user_token'
			? initSentryWithUser(env, executionCtx, props.user.id, request)
			: undefined,
	register(context) {
		registerWorkersTools(context)
		registerBuildsTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
