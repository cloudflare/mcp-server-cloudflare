# Cloudflare Radar MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Radar API](https://developers.cloudflare.com/radar/) to provide global
Internet traffic insights, trends and other utilities.

## 🔨 Available Tools

Currently available tools:

| **Category**           | **Tool**                  | **Description**                                                                                                           |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Requests**      | `get_http_requests_data`  | Fetches HTTP request data (timeseries, summaries, and grouped timeseries across dimensions like `deviceType`, `botClass`) |
| **Autonomous Systems** | `list_autonomous_systems` | Lists ASes; filter by location and sort by population size                                                                |
|                        | `get_as_details`          | Retrieves detailed info for a specific ASN                                                                                |
| **IP Addresses**       | `get_ip_details`          | Provides details about a specific IP address                                                                              |
| **Traffic Anomalies**  | `get_traffic_anomalies`   | Lists traffic anomalies; filter by AS, location, start date, and end date                                                 |
| **Domains**            | `get_domains_ranking`     | Get top or trending domains                                                                                               |
|                        | `get_domain_rank_details` | Get domain rank details                                                                                                   |
| **URL Scanner**        | `scan_url`                | Scans a URL via [Cloudflare’s URL Scanner](https://developers.cloudflare.com/radar/investigate/url-scanner/)              |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `What are the most used operating systems?`
- `What are the top 5 ASes in Portugal?`
- `Get information about ASN 13335.`
- `What are the details of IP address 1.1.1.1?`
- `List me traffic anomalies in Syria over the last year.`
- `Compare domain rankings in the US and UK.`
- `Give me rank details for google.com in March 2025.`
- `Scan https://example.com.`

## Access the remote MCP server from from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://radar.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://radar.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
