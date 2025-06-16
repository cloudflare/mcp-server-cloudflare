import type { UserDetails } from '@repo/mcp-common/src/durable-objects/user_details.do'
import type { WorkersBindingsMCP } from './bindings.app'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production' | 'test'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<WorkersBindingsMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	MCP_METRICS: AnalyticsEngineDataset
	CLOUDFLARE_API_TOKEN: string
	OPENAI_API_KEY: string
	AI_GATEWAY_TOKEN: string
	CLOUDFLARE_ACCOUNT_ID: string
	AI_GATEWAY_ID: string
	AI: Ai
	VECTORIZE: VectorizeIndex
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
