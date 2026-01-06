import type { RadarMCP, UserDetails } from './radar.app'

export interface Env {
	OAUTH_KV: KVNamespace
	MCP_COOKIE_ENCRYPTION_KEY: string
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
such as line charts, pie charts, bar charts, stacked area charts, choropleth maps, treemaps, or other relevant chart types.

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

### Cloud Observatory (Origins)

The Cloud Observatory tools (\`list_origins\`, \`get_origin_details\`, \`get_origins_timeseries\`, \`get_origins_summary\`,
\`get_origins_timeseries_groups\`) provide performance insights for major cloud providers (hyperscalers):
- **AMAZON** (AWS)
- **GOOGLE** (GCP)
- **MICROSOFT** (Azure)
- **ORACLE** (OCI)

Available metrics include:
- \`TCP_RTT\`: TCP round-trip time (latency)
- \`TCP_HANDSHAKE_DURATION\`: Time to establish TCP connection
- \`TLS_HANDSHAKE_DURATION\`: Time to complete TLS handshake
- \`RESPONSE_HEADER_RECEIVE_DURATION\`: Time to first byte (TTFB)
- \`CONNECTION_FAILURES\`: Failed connection attempts
- \`REQUESTS\`: Total request volume

You can filter by specific cloud regions (e.g., \`us-east-1\`, \`eu-west-1\`) and group results by:
- \`REGION\`: Compare performance across cloud regions
- \`SUCCESS_RATE\`: Analyze connection reliability
- \`PERCENTILE\`: View p50, p90, p99 latency distributions
`
