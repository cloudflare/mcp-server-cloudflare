import type { WorkersBindingsMCP } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: '<PLACEHOLDER>'
	MCP_SERVER_VERSION: '<PLACEHOLDER>'
	CLOUDFLARE_CLIENT_ID: '<PLACEHOLDER>'
	CLOUDFLARE_CLIENT_SECRET: '<PLACEHOLDER>'
	MCP_OBJECT: DurableObjectNamespace<WorkersBindingsMCP>
	MCP_METRICS: AnalyticsEngineDataset
}
