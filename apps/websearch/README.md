# Web Search MCP Server 🔎

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates a web search **discovery** tool powered by the Cloudflare Web Search API: it returns ranked links with metadata (title, description, image, and more), not page contents, for agents to fetch themselves.

## 🔨 Available Tools

Currently available tools:

| **Category**   | **Tool**     | **Description**                                                                                               |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Web Search** | `web_search` | Discovery tool — returns ranked links with metadata (title, description, image, and more), not page contents. |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Search the web for the latest Cloudflare Workers release notes`
- `Find recent articles about MCP servers`

## Access the remote MCP server from any MCP Client

This server exposes a native remote MCP endpoint at `https://websearch.mcp.cloudflare.com/mcp`. Any MCP client with first-class support for remote servers can connect to it directly, with no local proxy required. For example, [Cloudflare AI Playground](https://playground.ai.cloudflare.com/) lets you paste the server URL directly.

For clients that use a JSON config file, add it as a remote server:

```json
{
	"mcpServers": {
		"cloudflare-websearch": {
			"url": "https://websearch.mcp.cloudflare.com/mcp"
		}
	}
}
```

Connecting to the URL triggers the Cloudflare OAuth flow in your browser. To skip OAuth, send a Cloudflare API token as a `Bearer` token instead:

```json
{
	"mcpServers": {
		"cloudflare-websearch": {
			"url": "https://websearch.mcp.cloudflare.com/mcp",
			"headers": {
				"Authorization": "Bearer <your-cloudflare-api-token>"
			}
		}
	}
}
```

## Authentication

This server supports two authentication modes:

- **OAuth** — connect to the server URL and complete the Cloudflare OAuth flow.
- **API token** — send a Cloudflare API token as a `Bearer` token in the `Authorization` header to skip OAuth and call the Web Search API directly.
