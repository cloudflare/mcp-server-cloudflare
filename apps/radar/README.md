# Cloudflare Radar MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Radar API](https://developers.cloudflare.com/radar/) to provide global
Internet traffic insights, trends and other utilities.

## 🔨 Available Tools

Currently available tools:

| **Category**                 | **Tool**                            | **Description**                                                                                                      |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **AI**                       | `get_ai_data`                       | Retrieves AI-related data, including traffic from AI user agents, as well as popular models and model tasks          |
| **Autonomous Systems**       | `list_autonomous_systems`           | Lists ASes; filter by location and sort by population size                                                           |
|                              | `get_as_details`                    | Retrieves detailed info for a specific ASN                                                                           |
| **BGP**                      | `get_bgp_hijacks`                   | Retrieves BGP hijack events with filtering by hijacker/victim ASN, confidence score                                  |
|                              | `get_bgp_leaks`                     | Retrieves BGP route leak events                                                                                      |
|                              | `get_bgp_route_stats`               | Retrieves BGP routing table statistics                                                                               |
| **Bots**                     | `get_bots_data`                     | Retrieves bot traffic data by name, operator, category (AI crawlers, search engines, etc.)                           |
| **Certificate Transparency** | `get_certificate_transparency_data` | Retrieves CT log data for SSL/TLS certificate issuance trends                                                        |
| **Cloud Observatory**        | `list_origins`                      | Lists cloud provider origins (AWS, GCP, Azure, OCI)                                                                  |
|                              | `get_origin_details`                | Gets details for a specific cloud provider                                                                           |
|                              | `get_origins_data`                  | Retrieves cloud provider performance metrics (timeseries, summaries, grouped by region/percentile)                   |
| **Domains**                  | `get_domains_ranking`               | Gets top or trending domains                                                                                         |
|                              | `get_domain_rank_details`           | Gets domain rank details                                                                                             |
| **DNS**                      | `get_dns_queries_data`              | Retrieves DNS query data to 1.1.1.1, including timeseries, summaries, and breakdowns by dimensions like `queryType`  |
| **Email Routing**            | `get_email_routing_data`            | Retrieves Email Routing data, including timeseries, and breakdowns by dimensions like `encrypted`                    |
| **Email Security**           | `get_email_security_data`           | Retrieves Email Security data, including timeseries, and breakdowns by dimensions like `threatCategory`              |
| **HTTP**                     | `get_http_data`                     | Retrieves HTTP request data with geoId filtering for ADM1 (states/provinces)                                         |
| **IP Addresses**             | `get_ip_details`                    | Provides details about a specific IP address                                                                         |
| **Internet Services**        | `get_internet_services_ranking`     | Gets top Internet services                                                                                           |
| **Internet Quality**         | `get_internet_quality_data`         | Retrieves a summary or time series of bandwidth, latency, or DNS response time from the Radar Internet Quality Index |
| **Internet Speed**           | `get_internet_speed_data`           | Retrieves summary of bandwidth, latency, jitter, and packet loss, from the previous 90 days of Cloudflare Speed Test |
| **Layer 3 Attacks**          | `get_l3_attack_data`                | Retrieves L3 attack data, including timeseries, top attacks, and breakdowns by dimensions like `protocol`            |
| **Layer 7 Attacks**          | `get_l7_attack_data`                | Retrieves L7 attack data, including timeseries, top attacks, and breakdowns by dimensions like `mitigationProduct`   |
| **NetFlows**                 | `get_netflows_data`                 | Retrieves network traffic patterns with geoId filtering for ADM1 (states/provinces)                                  |
| **Traffic Anomalies**        | `get_traffic_anomalies`             | Lists traffic anomalies and outages; filter by AS, location, start date, and end date                                |
| **URL Scanner**              | `search_url_scans`                  | Search URL scans using ElasticSearch-like query syntax                                                               |
|                              | `create_url_scan`                   | Submit a URL to scan, returns scan UUID                                                                              |
|                              | `get_url_scan`                      | Get scan results by UUID (verdicts, page info, stats)                                                                |
|                              | `get_url_scan_screenshot`           | Get screenshot URL for a completed scan                                                                              |
|                              | `get_url_scan_har`                  | Get HAR (HTTP Archive) data for a completed scan                                                                     |

### Prompt Examples

- `What are the most used operating systems?`
- `What are the top 5 ASes in Portugal?`
- `Get information about ASN 13335.`
- `What are the details of IP address 1.1.1.1?`
- `List me traffic anomalies in Syria over the last year.`
- `Compare domain rankings in the US and UK.`
- `Give me rank details for google.com in March 2025.`
- `Scan https://example.com.`
- `Show me HTTP traffic trends from Portugal.`
- `Show me application layer attack trends from the last 7 days.`
- `Show me recent BGP hijack events.`
- `What AI crawlers are most active?`
- `What are the most active CAs?`
- `What are the top 5 AWS regions in terms of traffic?`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://radar.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://radar.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
