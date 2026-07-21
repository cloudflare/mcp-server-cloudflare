import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { RequiredScopes } from '@repo/mcp-common/src/scopes'

import { registerDEXTools } from './tools/dex-analysis.tools'

import type { Env } from './dex-analysis.context'

export { WarpDiagReader } from './warp_diag_reader'

const DexScopes = {
	...RequiredScopes,
	'account:read': 'See your account info such as account details, analytics, and memberships.',
	'dex:write':
		'Grants write level access to DEX resources like tests, fleet status, and remote captures.',
} as const

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['dex-staging.mcp.cloudflare.com', 'dex.mcp.cloudflare.com'],
	scopes: DexScopes,
	register: registerDEXTools,
})

export const mcpHandler = app.mcpHandler

export default app.worker
