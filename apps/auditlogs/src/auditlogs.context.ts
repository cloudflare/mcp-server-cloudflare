import type { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import type { AuditlogMCP } from './auditlogs.app'

export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_ACCESS_TOKEN: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<AuditlogMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	MCP_METRICS: AnalyticsEngineDataset
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
