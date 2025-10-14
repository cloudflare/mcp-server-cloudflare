# Cloudflare DNS Analytics MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare DNS Analytics API](https://developers.cloudflare.com/api/resources/dns/) to provide insights on DNS analytics and optimization.

## 🔨 Available Tools

Currently available tools:

| **Category**            | **Tool**                    | **Description**                                                |
| ----------------------- | --------------------------- | -------------------------------------------------------------- |
| **Zone Information**    | `zones_list`                | List zones under the current active account.                   |
| **DNS Analytics**       | `dns_report`                | Fetch the DNS Report for a given zone over a given time frame. |
| **Account DNS Setting** | `show_account_dns_settings` | Fetch the DNS setting for the current active account.          |
| **Zone DNS Setting**    | `show_zone_dns_settings`    | Fetch the DNS setting for a given zone.                        |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List zones under my Cloudflare account.`
- `What are the DNS Settings for my account?`
- `Show me the zones under my account and fetch DNS Report for them.`
- `How can I optimize my DNS Setting based on my DNS Report?`
- `Which of my zones has the highest traffic?`
- `Read Cloudflare's documentation on managing DNS records and tell me how to optimize my DNS settings.`
- `Show me DNS Report for https://example.com in the last X days.`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://dns-analytics.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://dns-analytics.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
