# Cloudflare Radar MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Radar API](https://developers.cloudflare.com/radar/) to provide global
Internet traffic insights, trends and other utilities. Explore the data visually at [radar.cloudflare.com](https://radar.cloudflare.com).

## 🔨 Available Tools

Currently available tools:

| **Category**                            | **Tool**                            | **Description**                                                                                                      |
| --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **AI**                                  | `get_ai_data`                       | Retrieves AI-related data, including traffic from AI user agents, as well as popular models and model tasks          |
| **Events, Outages & Traffic Anomalies** | `get_annotations`                   | Retrieves annotations including Internet events, outages, and anomalies from various Cloudflare data sources         |
|                                         | `get_outages`                       | Retrieves Internet outages and anomalies with detected connectivity issues                                           |
|                                         | `get_outages_by_location`           | Gets outage counts aggregated by location - identify which countries have the most outages                           |
|                                         | `get_traffic_anomalies`             | Lists traffic anomalies and outages; filter by AS, location, start date, and end date                                |
|                                         | `get_traffic_anomalies_by_location` | Gets traffic anomalies aggregated by location - shows which countries have the most detected outage signals          |
| **AS112**                               | `get_as112_data`                    | Retrieves AS112 DNS sink hole data for reverse DNS lookups of private IP addresses (RFC 1918)                        |
| **Autonomous Systems**                  | `list_autonomous_systems`           | Lists ASes; filter by location and sort by population size                                                           |
|                                         | `get_as_details`                    | Retrieves detailed info for a specific ASN                                                                           |
|                                         | `get_as_set`                        | Gets IRR AS-SETs that an AS is a member of                                                                           |
|                                         | `get_as_relationships`              | Gets AS-level relationships (peer, upstream, downstream)                                                             |
| **BGP**                                 | `get_bgp_hijacks`                   | Retrieves BGP hijack events with filtering by hijacker/victim ASN, confidence score                                  |
|                                         | `get_bgp_leaks`                     | Retrieves BGP route leak events                                                                                      |
|                                         | `get_bgp_route_stats`               | Retrieves BGP routing table statistics                                                                               |
|                                         | `get_bgp_timeseries`                | Retrieves BGP updates time series (announcements and withdrawals)                                                    |
|                                         | `get_bgp_top_ases`                  | Gets top ASes by BGP update count                                                                                    |
|                                         | `get_bgp_top_prefixes`              | Gets top IP prefixes by BGP update count                                                                             |
|                                         | `get_bgp_moas`                      | Gets Multi-Origin AS (MOAS) prefixes                                                                                 |
|                                         | `get_bgp_pfx2as`                    | Gets prefix-to-ASN mapping                                                                                           |
|                                         | `get_bgp_ip_space_timeseries`       | Retrieves announced IP address space over time (IPv4 /24s and IPv6 /48s) - useful for detecting route withdrawals    |
|                                         | `get_bgp_routes_realtime`           | Gets real-time BGP routes for a prefix using RouteViews and RIPE RIS collectors                                      |
|                                         | `get_bgp_routing_table_ases`        | Lists all ASes in global routing tables with routing statistics (prefix counts, RPKI status)                         |
|                                         | `get_bgp_top_ases_by_prefixes`      | Gets top ASes ordered by announced prefix count - shows which networks have the largest routing footprint            |
| **Bots**                                | `get_bots_data`                     | Retrieves bot traffic data by name, operator, category (AI crawlers, search engines, etc.)                           |
|                                         | `list_bots`                         | Lists known bots with details (AI crawlers, search engines, monitoring bots)                                         |
|                                         | `get_bot_details`                   | Gets detailed information about a specific bot by slug                                                               |
|                                         | `get_bots_crawlers_data`            | Retrieves web crawler HTTP request data by client type, user agent, referrer, industry                               |
| **Certificate Transparency**            | `get_certificate_transparency_data` | Retrieves CT log data for SSL/TLS certificate issuance trends                                                        |
|                                         | `list_ct_authorities`               | Lists Certificate Authorities tracked in CT logs                                                                     |
|                                         | `get_ct_authority_details`          | Gets details for a specific CA by fingerprint                                                                        |
|                                         | `list_ct_logs`                      | Lists Certificate Transparency logs                                                                                  |
|                                         | `get_ct_log_details`                | Gets details for a specific CT log by slug                                                                           |
| **Cloud Observatory**                   | `list_origins`                      | Lists cloud provider origins (AWS, GCP, Azure, OCI)                                                                  |
|                                         | `get_origin_details`                | Gets details for a specific cloud provider                                                                           |
|                                         | `get_origins_data`                  | Retrieves cloud provider performance metrics (timeseries, summaries, grouped by region/percentile)                   |
| **Domains**                             | `get_domains_ranking`               | Gets top or trending domains                                                                                         |
|                                         | `get_domain_rank_details`           | Gets domain rank details                                                                                             |
|                                         | `get_domains_ranking_timeseries`    | Gets domain ranking timeseries data to track how domains rank over time                                              |
| **DNS**                                 | `get_dns_queries_data`              | Retrieves DNS query data to 1.1.1.1, including timeseries, summaries, and breakdowns by dimensions like `queryType`  |
| **Email Routing**                       | `get_email_routing_data`            | Retrieves Email Routing data, including timeseries, and breakdowns by dimensions like `encrypted`                    |
| **Email Security**                      | `get_email_security_data`           | Retrieves Email Security data, including timeseries, and breakdowns by dimensions like `threatCategory`              |
| **Geolocations**                        | `list_geolocations`                 | Lists available geolocations (ADM1 - states/provinces) with GeoNames IDs                                             |
|                                         | `get_geolocation_details`           | Gets details for a specific geolocation by GeoNames ID                                                               |
| **HTTP**                                | `get_http_data`                     | Retrieves HTTP request data with geoId filtering for ADM1 (states/provinces)                                         |
| **IP Addresses**                        | `get_ip_details`                    | Provides details about a specific IP address including full ASN details (name, country, population estimates)        |
| **Internet Services**                   | `get_internet_services_ranking`     | Gets top Internet services                                                                                           |
|                                         | `get_internet_services_timeseries`  | Tracks internet service ranking changes over time (e.g., how ChatGPT ranks over months)                              |
| **Internet Quality & Speed**            | `get_internet_quality_data`         | Retrieves a summary or time series of bandwidth, latency, or DNS response time from the Radar Internet Quality Index |
|                                         | `get_internet_speed_data`           | Retrieves summary of bandwidth, latency, jitter, and packet loss, from the previous 90 days of Cloudflare Speed Test |
|                                         | `get_speed_histogram`               | Gets speed test histogram data showing distribution of results for bandwidth, latency, or jitter                     |
| **Layer 3 Attacks**                     | `get_l3_attack_data`                | Retrieves network layer (L3/DDoS) attack data, including timeseries, top attacks, and breakdowns by dimensions       |
| **Layer 7 Attacks**                     | `get_l7_attack_data`                | Retrieves L7 attack data, including timeseries, top attacks, and breakdowns by dimensions like `mitigationProduct`   |
| **Leaked Credentials**                  | `get_leaked_credentials_data`       | Retrieves trends in HTTP auth requests and compromised credential detection                                          |
| **NetFlows**                            | `get_netflows_data`                 | Retrieves network traffic patterns with geoId filtering for ADM1 (states/provinces)                                  |
| **Robots.txt**                          | `get_robots_txt_data`               | Retrieves robots.txt analysis data showing crawler access rules across domains                                       |
| **TCP Quality**                         | `get_tcp_resets_timeouts_data`      | Retrieves TCP connection quality metrics (resets and timeouts)                                                       |
| **TLDs**                                | `list_tlds`                         | Lists top-level domains (TLDs) including generic, country-code, and sponsored TLDs                                   |
|                                         | `get_tld_details`                   | Gets detailed information about a specific TLD                                                                       |
| **URL Scanner**                         | `search_url_scans`                  | Search URL scans using ElasticSearch-like query syntax                                                               |
|                                         | `create_url_scan`                   | Submit a URL to scan, returns scan UUID                                                                              |
|                                         | `get_url_scan`                      | Get scan results by UUID (verdicts, page info, stats)                                                                |
|                                         | `get_url_scan_screenshot`           | Get screenshot URL for a completed scan                                                                              |
|                                         | `get_url_scan_har`                  | Get HAR (HTTP Archive) data for a completed scan                                                                     |

### Prompt Examples

**Traffic & Network Analysis**

- `What are the most used operating systems?`
- `Show me HTTP traffic trends from Lisbon, Portugal.`
- `What is the TCP reset and timeout rate globally?`
- `Show me network traffic patterns for California.`
- `Compare HTTP traffic between mobile and desktop devices.`
- `What percentage of traffic uses IPv6 vs IPv4?`

**Autonomous Systems & BGP**

- `What are the top 5 ASes in Portugal?`
- `Get information about ASN 13335.`
- `What are the relationships (peers, upstreams) for Cloudflare's AS?`
- `Show me recent BGP hijack events with high confidence.`
- `Which prefixes have the most BGP updates?`
- `What AS announces the prefix 1.1.1.0/24?`
- `Show me IPv6 announced address space for Portugal over the last 30 days.`
- `Compare IPv4 vs IPv6 BGP address space trends for AS13335.`
- `Get real-time BGP routes for prefix 1.1.1.0/24.`
- `List the top ASes by prefix count in Germany.`
- `Which ASes have the most IPv6 address space globally?`
- `Show me BGP route leak events from the last week.`

**Security & Attacks**

- `Show me application layer attack trends from the last 7 days.`
- `What are the top L3 attack vectors?`
- `Show me leaked credential detection trends.`
- `Scan https://example.com for security analysis.`
- `Which industries are most targeted by DDoS attacks?`

**Bots & Crawlers**

- `What AI crawlers are most active?`
- `List all known AI crawler bots.`
- `How are websites configuring robots.txt for AI crawlers?`
- `What percentage of sites block vs allow AI crawlers?`
- `Show me crawler traffic by industry.`

**DNS**

- `What are the most common DNS query types to 1.1.1.1?`
- `Show me AS112 DNS queries by protocol.`
- `What is the DNSSEC adoption rate?`
- `Show me DNS query trends by response code.`

**Email**

- `What are the email security threat trends?`
- `Show me email routing data by encryption status.`
- `What percentage of emails fail DMARC validation?`
- `Which TLDs send the most malicious emails?`

**Certificate Transparency**

- `What are the most active Certificate Authorities?`
- `List Certificate Transparency logs.`
- `Show me certificate issuance trends by validation level.`
- `Get details for the CT log argon2026h1.`
- `What is the top Certificate Authority and show me its details.`

**Rankings & Internet Services**

- `What are the top trending domains?`
- `Compare domain rankings in the US and UK.`
- `What are the top Internet services in the E-commerce category?`
- `Track how google.com ranks over the last 30 days.`
- `How has ChatGPT's ranking changed over the last 6 months?`

**TLDs**

- `List all country-code TLDs.`
- `Show me details about the .io TLD.`
- `Give me a ranking of TLDs based on DNS magnitude.`

**Speed & Quality**

- `Show me the bandwidth distribution histogram for the US.`
- `What is the average latency in Portugal?`
- `Which countries have the fastest internet speeds?`
- `Show me top ASes by download bandwidth.`

**Outages & Events**

- `Show me recent Internet outages.`
- `Which countries have the most Internet outages?`
- `Show me verified traffic anomalies by location.`

**Cloud & Infrastructure**

- `What are the top AWS regions by traffic?`
- `Compare latency between Azure and GCP regions.`
- `What is the connection success rate for cloud providers?`

**IP Information**

- `What are the details of IP address 8.8.8.8?`
- `Give me full information about IP 1.1.1.1 including ASN details.`

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
