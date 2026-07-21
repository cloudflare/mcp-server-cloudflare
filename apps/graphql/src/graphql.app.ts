import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'
import { initSentryWithUser } from '@repo/mcp-common/src/sentry'
import { registerZoneTools } from '@repo/mcp-common/src/tools/zone.tools'

import { registerGraphQLTools } from './tools/graphql.tools'

import type { Env } from './graphql.context'

const GraphQLScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'zone:read': 'See zone data such as settings, analytics, and DNS records.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['graphql-staging.mcp.cloudflare.com', 'graphql.mcp.cloudflare.com'],
	scopes: GraphQLScopes,
	createSentry: ({ env, executionCtx, request, props }) =>
		props?.type === 'user_token'
			? initSentryWithUser(env, executionCtx, props.user.id, request)
			: undefined,
	register(context) {
		registerZoneTools(context)
		registerGraphQLTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
