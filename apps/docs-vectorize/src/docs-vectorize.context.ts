import type { CloudflareDocumentationMCP } from './docs-vectorize.app'

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_OBJECT: DurableObjectNamespace<CloudflareDocumentationMCP>
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
	VECTORIZE: VectorizeIndex
}
