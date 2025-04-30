# Cloudflare AutoRAG MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare AutoRAG API](https://developers.cloudflare.com/autorag/) to provide global
Internet traffic insights, trends and other utilities.

## 🔨 Available Tools

Currently available tools:

| **Tool**    | **Description**                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| `list_rags` | Lists AutoRAGs with pagination support                                           |
| `search`    | Searches documents in a specified AutoRAG using a query (URL, title, or snippet) |
| `ai_search` | Performs AI-powered search on documents in a specified AutoRAG                   |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List all AutoRAGs in my account.`
- `Search for documents in AutoRAG with ID 'rag123' using the query 'cloudflare security'.`
- `Perform an AI search in AutoRAG with ID 'rag456' for 'best practices for vector stores'.`

## Access the remote MCP server from from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://autorag.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using mcp-remote (https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://autorag.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
