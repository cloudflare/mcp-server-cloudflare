import { type McpAgent } from 'agents/mcp'

import type { AuthProps } from '../cloudflare-oauth-handler'
import type { CloudflareMCPServer } from '../server'

export type CloudflareMCPAgentState = { activeAccountId: string | null }

export type CloudflareMCPAgentProps = AuthProps

// We omit server in this type, so that we can later use our own CloudflareMCPServer type ( which extends McpServer )
type McpAgentWithoutServer<EnvType = unknown> = Omit<
	McpAgent<EnvType, CloudflareMCPAgentState, CloudflareMCPAgentProps>,
	'server'
>

export interface CloudflareMcpAgentNoAccount<EnvType = unknown>
	extends McpAgentWithoutServer<EnvType> {
	server: CloudflareMCPServer
}

export interface CloudflareMcpAgent<EnvType = unknown>
	extends CloudflareMcpAgentNoAccount<EnvType> {
	setActiveAccountId(accountId: string): Promise<void>
	getActiveAccountId(): Promise<string | null>
}
