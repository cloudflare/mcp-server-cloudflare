# Cloudflare Documentation MCP Server (via Vectorize) 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections. It connects to a Vectorize DB (in this case, indexed w/ the Cloudflare docs)

The Cloudflare account this worker is deployed on already has this Vectorize DB setup and indexed.

The `/mcp` endpoint creates a fresh SDK v2 server for every request. It supports modern MCP requests and the default stateless 2025 compatibility path; it does not expose a legacy HTTP+SSE endpoint or keep MCP protocol sessions. This public documentation server does not require authentication.

## 🔨 Available Tools

Currently available tools:

| **Category**                 | **Tool**                          | **Description**                      |
| ---------------------------- | --------------------------------- | ------------------------------------ |
| **Cloudflare Documentation** | `search_cloudflare_documentation` | Search the Cloudflare documentation. |

### Prompt Examples

- `Do Cloudflare Workers costs depend on response sizes? I want to serve some images (map tiles) from an R2 bucket and I'm concerned about costs.`
- `How many indexes are supported in Workers Analytics Engine? Give an example using the Workers binding api.`
- `Can you give me some information on how to use the Workers AutoRAG binding`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://docs-vectorize.mcp.cloudflare.com/mcp`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://docs-vectorize.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you have set up the configuration file, restart your MCP client. The documentation tools will become available without an OAuth login.

Interested in contributing, and running this server locally? See the [CONTRIBUTING.md](../../CONTRIBUTING.md) in the repo root to get started.
