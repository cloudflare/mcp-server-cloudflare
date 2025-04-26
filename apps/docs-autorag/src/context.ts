import type { CloudflareDocumentationMCP } from './index'

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	AUTORAG_NAME: 'cloudflare-docs-autorag'
	MCP_SERVER_NAME: 'PLACEHOLDER'
	MCP_SERVER_VERSION: 'PLACEHOLDER'
	MCP_OBJECT: DurableObjectNamespace<CloudflareDocumentationMCP>
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
}
