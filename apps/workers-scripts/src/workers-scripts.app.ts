import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerWorkersScriptsTools } from './tools/workers-scripts.tools'

import type { Env } from './workers-scripts.context'

const WorkersScriptsScopes = {
	...RequiredScopes,
	'account:read': 'See account information and account memberships.',
	'workers:read': 'Read Worker scripts, versions, and deployments.',
	'workers:write': 'Create, update, deploy, or delete Worker scripts and deployments.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serverId: 'workers-scripts',
	serviceHostnames: ['workers-staging.mcp.cloudflare.com', 'workers.mcp.cloudflare.com'],
	scopes: WorkersScriptsScopes,
	serverOptions: {
		instructions:
			'Manage Cloudflare Workers scripts, versions, and deployments. Script uploads through workers_scripts_upload immediately publish the uploaded version. For staged changes, upload a version and create a deployment with explicit version percentages totaling 100. Uploads inherit existing named bindings and compatibility flags but cannot add or change bindings.',
	},
	register(context) {
		registerWorkersScriptsTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
