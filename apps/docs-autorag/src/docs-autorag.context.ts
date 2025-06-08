import type { CloudflareDocumentationMCP } from './docs-autorag.app'

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	AUTORAG_NAME: 'cloudflare-docs-autorag'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_OBJECT: DurableObjectNamespace<CloudflareDocumentationMCP>
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
}
