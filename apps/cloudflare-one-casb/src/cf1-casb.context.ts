import type { CASBMCP, UserDetails } from './cf1-casb.app'

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_OBJECT: DurableObjectNamespace<CASBMCP>
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
