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

This server provides tools powered by the Cloudflare Radar API for global Internet insights.

## Authentication

- **URL Scanner** requires an active account (use \`set_active_account\`)
- All other Radar data tools work without account selection

## Tool Categories

- **Entities**: Look up ASN, IP, and location details (\`list_autonomous_systems\`, \`get_as_details\`, \`get_ip_details\`)
- **Traffic**: HTTP and DNS trends (\`get_http_data\`, \`get_dns_queries_data\`)
- **Attacks**: Layer 3/7 DDoS attack trends (\`get_l3_attack_data\`, \`get_l7_attack_data\`)
- **Email**: Routing and security trends (\`get_email_routing_data\`, \`get_email_security_data\`)
- **Quality**: Internet speed and quality metrics (\`get_internet_quality_data\`, \`get_internet_speed_data\`)
- **Rankings**: Top domains and services (\`get_domains_ranking\`, \`get_internet_services_ranking\`)
- **AI**: AI bot traffic and Workers AI usage (\`get_ai_data\`)
- **BGP**: Route hijacks, leaks, and stats (\`get_bgp_hijacks\`, \`get_bgp_leaks\`, \`get_bgp_route_stats\`)
- **Bots**: Bot traffic by category, operator, kind (\`get_bots_data\`)
- **Certificate Transparency**: SSL/TLS certificate issuance trends (\`get_certificate_transparency_data\`)
- **NetFlows**: Network traffic patterns with ADM1 filtering (\`get_netflows_data\`)
- **Cloud Observatory**: Cloud provider performance - AWS, GCP, Azure, OCI (\`list_origins\`, \`get_origin_details\`, \`get_origins_data\`)
- **URL Scanner**: Scan and analyze URLs for security threats (\`search_url_scans\`, \`create_url_scan\`, \`get_url_scan\`, \`get_url_scan_screenshot\`, \`get_url_scan_har\`)

## Making Comparisons

Many tools support **array-based filters** for comparisons. Each array index corresponds to a distinct data series.
Example: Compare HTTP traffic between Portugal and Spain over the last 7 days:
- \`dateRange: ["7d", "7d"]\`
- \`location: ["PT", "ES"]\`

## Geographic Filtering

- **location**: Filter by country (alpha-2 codes like "US", "PT")
- **continent**: Filter by continent (alpha-2 codes like "EU", "NA")
- **geoId**: Filter by ADM1 region (GeoNames IDs for states/provinces) - available for HTTP and NetFlows

## Visualizations

Generate charts when appropriate:
- **Line charts**: Timeseries data
- **Bar charts**: Rankings, summaries
- **Pie charts**: Distributions
- **Choropleth maps**: Geographic data
- **Stacked area charts**: Grouped timeseries
`
