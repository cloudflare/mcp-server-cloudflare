# Cloudflare Documentation MCP Server (via AI Search) 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections. It uses Cloudflare AI Search (AutoRAG) to provide contextual search of the Cloudflare Developer Documentation.

The Cloudflare account this worker is deployed on has an AI Search instance configured with the complete Cloudflare Developer Documentation.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server for every request. `/sse` is not the deprecated HTTP+SSE transport. The handler supports modern MCP requests and stateless 2025 compatibility without an MCP protocol session. This public documentation server does not require authentication.

## 🔨 Available Tools

Currently available tools:

| **Category**                 | **Tool**                          | **Description**                      |
| ---------------------------- | --------------------------------- | ------------------------------------ |
| **Cloudflare Documentation** | `search_cloudflare_documentation` | Search the Cloudflare documentation. |

### Prompt Examples

- `Do Cloudflare Workers costs depend on response sizes? I want to serve some images (map tiles) from an R2 bucket and I'm concerned about costs.`
- `How many indexes are supported in Workers Analytics Engine? Give an example using the Workers binding api.`
- `Can you give me some information on how to use the Workers AI Search binding`

## Connect to the MCP server

Connect your MCP client directly to `https://docs.mcp.cloudflare.com/mcp`. This server does not require OAuth.

Interested in contributing, and running this server locally? See the [CONTRIBUTING.md](../../CONTRIBUTING.md) in the repo root to get started.
