import { type McpAgent } from 'agents/mcp'

import type { AuthProps } from '../cloudflare-oauth-handler'
import type { CloudflareMCPServer } from '../server'

// Base agent state shared across servers. Account resolution is centralized in AccountManager
// (no longer persisted as state), so the base carries no fields; individual servers may add
// their own state (e.g. workers-builds tracks the active build/worker), hence the permissive
// index signature so those servers stay assignable to CloudflareMcpAgent.
export type CloudflareMCPAgentState = Record<string, unknown>

export type CloudflareMCPAgentProps = AuthProps

// We omit server in this type, so that we can later use our own CloudflareMCPServer type ( which extends McpServer )
type McpAgentWithoutServer<EnvType extends Cloudflare.Env = Cloudflare.Env> = Omit<
	McpAgent<EnvType, CloudflareMCPAgentState, CloudflareMCPAgentProps>,
	'server'
>

// Account resolution is centralized in AccountManager + CloudflareMCPServer.accountTool,
// so agents no longer carry get/setActiveAccountId.
export interface CloudflareMcpAgent<EnvType extends Cloudflare.Env = Cloudflare.Env>
	extends McpAgentWithoutServer<EnvType> {
	server: CloudflareMCPServer
}
