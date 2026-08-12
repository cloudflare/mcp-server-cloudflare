# Cloudflare GraphQL MCP Server

## Deprecated

This dedicated MCP server is deprecated. Use the Cloudflare API MCP server at [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) instead. It supports the Cloudflare GraphQL Analytics API, including queries, variables, and schema introspection.

The GraphQL Analytics API itself is not deprecated. Only this dedicated MCP server is being retired.

Configure the replacement server in your MCP client:

```json
{
	"mcpServers": {
		"cloudflare-api": {
			"url": "https://mcp.cloudflare.com/mcp"
		}
	}
}
```

The replacement uses [Code Mode](https://blog.cloudflare.com/code-mode-mcp/). Its `search` and `execute` tools cover the full Cloudflare API, including `POST /client/v4/graphql`. See the [GraphQL Analytics API example](https://github.com/cloudflare/mcp#graphql-analytics-api) in [`cloudflare/mcp`](https://github.com/cloudflare/mcp).

The tools below still work for now, but no new features will be added. Please migrate to the Cloudflare API MCP server.

---

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections, with Cloudflare OAuth built in. It integrates tools powered by the [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/) to provide insights and utilities for your Cloudflare account.

Until retirement, the `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth and account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth remains durable security state; the server retains no MCP protocol session or protocol Durable Object.

## Available tools

| **Category**                | **Tool**                  | **Description**                                                                                 |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| **GraphQL Schema Search**   | `graphql_schema_search`   | Search the Cloudflare GraphQL API schema for types, fields, and enum values matching a keyword  |
| **GraphQL Schema Overview** | `graphql_schema_overview` | Fetch the high-level overview of the Cloudflare GraphQL API schema                              |
| **GraphQL Type Details**    | `graphql_type_details`    | Fetch detailed information about a specific GraphQL type                                        |
| **GraphQL Complete Schema** | `graphql_complete_schema` | Fetch the complete Cloudflare GraphQL API schema (combines overview and important type details) |
| **GraphQL Query Execution** | `graphql_query`           | Execute a GraphQL query against the Cloudflare API                                              |
| **GraphQL API Explorer**    | `graphql_api_explorer`    | Generate a Cloudflare [GraphQL API Explorer](https://graphql.cloudflare.com/explorer) link      |

### Prompt examples

- `Show me HTTP traffic for the last 7 days for example.com`
- `Show me which GraphQL datatype I need to use to query firewall events`
- `Can you generate a link to the Cloudflare GraphQL API Explorer with a pre-populated query and variables?`
- `I need to monitor HTTP requests and responses for a specific domain. Can you help me with that using the Cloudflare GraphQL API?`

## Connect to the MCP server

> This connection information is retained for existing users. New users should configure [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) as shown above.

Connect your MCP client directly to `https://graphql.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Bug fixes are still accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup. New features should be proposed in the unified [`cloudflare/mcp`](https://github.com/cloudflare/mcp) repository.
