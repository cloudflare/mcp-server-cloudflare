import type { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details'
import type { LogsMCP } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_ACCESS_TOKEN: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<LogsMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	MCP_METRICS: AnalyticsEngineDataset
}