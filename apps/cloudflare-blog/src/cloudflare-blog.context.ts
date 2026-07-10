import type { CloudflareBlogMCP } from './cloudflare-blog.app'

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_OBJECT: DurableObjectNamespace<CloudflareBlogMCP>
	MCP_METRICS: AnalyticsEngineDataset
	SENTRY_ACCESS_CLIENT_ID: string
	SENTRY_ACCESS_CLIENT_SECRET: string
	GIT_HASH: string
	SENTRY_DSN: string
	/** Base URL for the Cloudflare Blog, e.g. https://blog.cloudflare.com */
	BLOG_BASE_URL: string
	/** Base URL for the AI Search public endpoint, e.g. https://search.blog.cloudflare.com */
	SEARCH_BASE_URL: string
}
