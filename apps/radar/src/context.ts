import type { RadarMCP } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production'
	ACCOUNT_ID: '6702657b6aa048cf3081ff3ff3c9c52f'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	URL_SCANNER_API_TOKEN: string
	MCP_OBJECT: DurableObjectNamespace<RadarMCP>
	MCP_METRICS: AnalyticsEngineDataset
}
