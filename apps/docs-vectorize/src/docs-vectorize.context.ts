export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_METRICS: AnalyticsEngineDataset
	SENTRY_ACCESS_CLIENT_ID: string
	SENTRY_ACCESS_CLIENT_SECRET: string
	GIT_HASH: string
	SENTRY_DSN: string
	AI: Ai
	VECTORIZE: VectorizeIndex
}
