# Cloudflare Documentation MCP Server (via Vectorize) 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections. It connects to a Vectorize DB (in this case, indexed w/ the Cloudflare docs)

The Cloudflare account this worker is deployed on already has this Vectorize DB setup and indexed.

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

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://docs.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://docs.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
