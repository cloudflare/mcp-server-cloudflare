import type { RadarMCP, UserDetails } from './index'

export interface Env {
	OAUTH_KV: KVNamespace
	ENVIRONMENT: 'development' | 'staging' | 'production'
	MCP_SERVER_NAME: string
	MCP_SERVER_VERSION: string
	CLOUDFLARE_CLIENT_ID: string
	CLOUDFLARE_CLIENT_SECRET: string
	MCP_OBJECT: DurableObjectNamespace<RadarMCP>
	USER_DETAILS: DurableObjectNamespace<UserDetails>
	MCP_METRICS: AnalyticsEngineDataset
	DEV_DISABLE_OAUTH: string
	DEV_CLOUDFLARE_API_TOKEN: string
	DEV_CLOUDFLARE_EMAIL: string
}

export const BASE_INSTRUCTIONS = /* markdown */ `
# Cloudflare Radar MCP Server

This server integrates tools powered by the Cloudflare Radar API to provide insights into global Internet traffic,
trends, and other related utilities.

An active account is **only required** for URL Scanner-related tools (e.g., \`scan_url\`).

For tools related to Internet trends and insights, analyze the results and, when appropriate, generate visualizations
such as XY charts, pie charts, bar charts, or other relevant chart types.

### Making comparisons

Many tools support **array-based filters** to enable comparisons across multiple criteria.
In such cases, the array index corresponds to a distinct data series.
For each data series, provide a corresponding \`dateRange\`, or alternatively a \`dateStart\` and \`dateEnd\` pair.
Example: To compare HTTP traffic between Portugal and Spain over the last 7 days:
- \`dateRange: ["7d", "7d"]\`
- \`location: ["PT", "ES"]\`

This applies to date filters and other filters that support comparison across multiple values.
If a tool does **not** support array-based filters, you can achieve the same comparison by making multiple separate
calls to the tool.
`
