import type { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import type { CloudflareDEXMCP } from './dex-analysis.app'
import type { WarpDiagReader } from './warp_diag_reader'

export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<CloudflareDEXMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	WARP_DIAG_READER: DurableObjectNamespace<WarpDiagReader>
	MCP_METRICS: AnalyticsEngineDataset
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
