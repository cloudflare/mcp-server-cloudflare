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

## Access the remote MCP server from Claude Desktop

Open Claude Desktop and navigate to `Settings -> Developer -> Edit Config`.
This opens the configuration file that controls which MCP servers Claude can access.

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

Once you restart Claude Desktop, a browser window will open showing your OAuth login page.
Complete the authentication flow to grant Claude access to your MCP server.
After you grant access, the tools will become available for you to use.

## Setup

#### Secrets

Set secrets via Wrangler:

```bash
npx wrangler secret put CLOUDFLARE_CLIENT_ID -e <ENVIRONMENT>
npx wrangler secret put CLOUDFLARE_CLIENT_SECRET -e <ENVIRONMENT>
npx wrangler secret put URL_SCANNER_API_TOKEN -e <ENVIRONMENT>
```

#### Set up a KV namespace

Create the KV namespace:

```bash
npx wrangler kv namespace create "OAUTH_KV"
```

Then, update the Wrangler file with the generated KV namespace ID.

#### Deploy & Test

Deploy the MCP server to make it available on your workers.dev domain:

```bash
npx wrangler deploy -e <ENVIRONMENT>
```

Test the remote server using [Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector@latest
```

## Local Development

If you'd like to iterate and test your MCP server, you can do so in local development.
This will require you to create another OAuth App on Cloudflare:

1. Create a `.dev.vars` file in your project root with:

   ```
   CLOUDFLARE_CLIENT_ID=your_development_cloudflare_client_id
   CLOUDFLARE_CLIENT_SECRET=your_development_cloudflare_client_secret
   URL_SCANNER_API_TOKEN=your_development_url_scanner_api_token
   ```

2. Start the local development server:

   ```bash
   npx wrangler dev
   ```

3. To test locally, open Inspector, and connect to `http://localhost:8976/sse`.
   Once you follow the prompts, you'll be able to "List Tools".

   You can also connect to Claude Desktop.
