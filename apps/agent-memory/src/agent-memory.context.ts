import type { AgentMemoryMCP } from './agent-memory.app'
import type { MemoryIndex } from './search/durable-object'

/**
 * Worker environment bindings for the Agent Memory MCP server.
 *
 * Note what is *not* here: there is no `AI` binding and no `R2Bucket`
 * binding. Both Workers AI and R2 are accessed through the *user's own*
 * Cloudflare account via the REST API, using the OAuth access token minted
 * during the authorization flow. That keeps all Workers AI and R2 spend
 * scoped to the end user rather than the account hosting this server.
 *
 * The only per-user state that lives on the server account is the search
 * index Durable Object (`MEMORY_INDEX`), which stores embeddings + a small
 * SQLite index. There is one instance per user (`idFromName(userId)`), so
 * the compute and storage there are naturally partitioned per user.
 */
export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
	ENVIRONMENT: 'development' | 'staging' | 'production' | 'test'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<AgentMemoryMCP>
	MEMORY_INDEX: DurableObjectNamespace<MemoryIndex>
	MCP_METRICS: AnalyticsEngineDataset
	/**
	 * Name of the R2 bucket created (idempotently) in each user's account to
	 * hold their memory files. Defaults to `agent-memory-mcp`.
	 */
	AGENT_MEMORY_BUCKET_NAME: string
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
