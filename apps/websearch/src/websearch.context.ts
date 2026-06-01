export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_METRICS: AnalyticsEngineDataset
	GIT_HASH: string
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}

export const BASE_INSTRUCTIONS = /* markdown */ `
# Cloudflare Web Search MCP Server

This server provides a web search **discovery** tool powered by the Cloudflare Web Search API.

It does **not** return the contents of pages. It returns a ranked list of **links**, each with related metadata such as title, description, image, and other fields. After running a search, review the results, decide which links are relevant to your task, and fetch those URLs yourself to read their contents.

## Tools

- **web_search**: Run a web search query and return ranked links, each with metadata (title, description, image, and more) — not page contents. The Cloudflare account is resolved from your credentials; if they span multiple accounts you'll be asked to pass an \`account_id\`.
`
