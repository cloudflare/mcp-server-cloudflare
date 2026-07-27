import type { CloudflareDevStackMCP } from './stack-mcp.app'

/**
 * Minimal typings for the AI Search namespace binding (`ai_search_namespaces`).
 * Hand-written so the prototype typechecks regardless of the wrangler version's
 * runtime types for this (beta) binding.
 */
export interface AiSearchChunk {
	text: string
	score: number
	item: { key: string; metadata?: Record<string, unknown> }
	/** Present on namespace-level (multi-instance) search: which instance the chunk came from. */
	instance_id?: string
}

export interface AiSearchResult {
	search_query?: string
	chunks: AiSearchChunk[]
	errors?: Array<{ instance_id: string; message: string }>
}

export interface AiSearchRetrievalOptions {
	max_num_results?: number
	match_threshold?: number
	retrieval_type?: 'vector' | 'keyword' | 'hybrid'
}

export interface AiSearchRerankingOptions {
	enabled?: boolean
	model?: string
	match_threshold?: number
}

export interface AiSearchInstance {
	search(params: {
		query: string
		ai_search_options?: {
			retrieval?: AiSearchRetrievalOptions
			reranking?: AiSearchRerankingOptions
		}
	}): Promise<AiSearchResult>
}

export interface AiSearchNamespace {
	/** Get a single instance handle within the bound namespace. */
	get(name: string): AiSearchInstance
	/** Search across multiple instances in the bound namespace (requires instance_ids, 1–10). */
	search(params: {
		query: string
		ai_search_options: {
			instance_ids: string[]
			retrieval?: AiSearchRetrievalOptions
			reranking?: AiSearchRerankingOptions
		}
	}): Promise<AiSearchResult>
}

export interface Env {
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	MCP_OBJECT: DurableObjectNamespace<CloudflareDevStackMCP>
	MCP_METRICS: AnalyticsEngineDataset
	/** AI Search namespace binding, scoped to the `dev-stack` namespace. */
	AI_SEARCH: AiSearchNamespace
}
