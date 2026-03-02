import type { ContainerManager, ContainerMcpAgent, UserContainer } from './sandbox.server.app'

export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	ENVIRONMENT: 'dev'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	OPENAI_API_KEY: string
	AI_GATEWAY_TOKEN: string
	CLOUDFLARE_ACCOUNT_ID: string
	AI_GATEWAY_ID: string
	MCP_OBJECT: DurableObjectNamespace<ContainerMcpAgent>
	CONTAINER_MANAGER: DurableObjectNamespace<ContainerManager>
	USER_CONTAINER: DurableObjectNamespace<UserContainer>
	USER_BLOCKLIST: KVNamespace
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}
