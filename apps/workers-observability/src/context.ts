import type { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details'
import type { ObservabilityMCP } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<ObservabilityMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	MCP_METRICS: AnalyticsEngineDataset
	SENTRY_ACCESS_CLIENT_ID: string
	SENTRY_ACCESS_CLIENT_SECRET: string
	GIT_HASH: string
	SENTRY_DSN: string
}
