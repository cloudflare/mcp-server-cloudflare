import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerContainerTools } from './container-tools'
import { ContainerManager } from './containerManager'
import { BASE_INSTRUCTIONS } from './prompts'
import { UserContainer } from './userContainer'

import type { Env } from './sandbox.server.context'

export { ContainerManager, UserContainer }

const ContainerScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['containers-staging.mcp.cloudflare.com', 'containers.mcp.cloudflare.com'],
	scopes: ContainerScopes,
	serverOptions: { instructions: BASE_INSTRUCTIONS },
	register: registerContainerTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
