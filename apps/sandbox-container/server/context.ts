import type { ContainerManager, ContainerMcpAgent } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	CLOUDFLARE_CLIENT_ID: '<PLACEHOLDER>'
	CLOUDFLARE_CLIENT_SECRET: '<PLACEHOLDER>'
	ENVIRONMENT: 'dev'
	MCP_SERVER_NAME: '<PLACEHOLDER>'
	MCP_SERVER_VERSION: '<PLACEHOLDER>'
	OPENAI_API_KEY: string
	CONTAINER_MCP_AGENT: DurableObjectNamespace<ContainerMcpAgent>
	CONTAINER_MANAGER: DurableObjectNamespace<ContainerManager>
	MCP_METRICS: AnalyticsEngineDataset
	AI: Ai
}
