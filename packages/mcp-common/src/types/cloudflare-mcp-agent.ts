import { type McpAgent } from 'agents/mcp'

import { type AccountSchema, type UserSchema } from '../cloudflare-oauth-handler'

import type { CloudflareMCPServer } from '../server'

export type CloudflareMCPAgentState = { activeAccountId: string | null }

export type CloudflareMCPAgentProps = {
	accessToken: string
	user: UserSchema['result']
	accounts: AccountSchema['result']
}

// We omit server in this type, so that we can later use our own CloudflareMCPServer type ( which extends McpServer )
type McpAgentWithoutServer<EnvType = unknown> = Omit<
	McpAgent<EnvType, CloudflareMCPAgentState, CloudflareMCPAgentProps>,
	'server'
>

export interface CloudflareMcpAgent<EnvType = unknown> extends McpAgentWithoutServer<EnvType> {
	server: CloudflareMCPServer
	setActiveAccountId(accountId: string): void
	getActiveAccountId(): string | null
}
