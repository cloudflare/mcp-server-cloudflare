# Cloudflare GraphQL MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in. It integrates tools powered by the [Cloudflare GraphQL API](https://developers.cloudflare.com/analytics/graphql-api/) to provide insights and utilities for your Cloudflare account.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth remains durable security state; no MCP protocol session or protocol Durable Object is retained.

## Available Tools

Currently available tools:

| **Category**                | **Tool**                  | **Description**                                                                                 |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| **GraphQL Schema Search**   | `graphql_schema_search`   | Search the Cloudflare GraphQL API schema for types, fields, and enum values matching a keyword  |
| **GraphQL Schema Overview** | `graphql_schema_overview` | Fetch the high-level overview of the Cloudflare GraphQL API schema                              |
| **GraphQL Type Details**    | `graphql_type_details`    | Fetch detailed information about a specific GraphQL type                                        |
| **GraphQL Complete Schema** | `graphql_complete_schema` | Fetch the complete Cloudflare GraphQL API schema (combines overview and important type details) |
| **GraphQL Query Execution** | `graphql_query`           | Execute a GraphQL query against the Cloudflare API                                              |
| **GraphQL API Explorer**    | `graphql_api_explorer`    | Generate a Cloudflare [GraphQL API Explorer](https://graphql.cloudflare.com/explorer) link      |

### Prompt Examples

- `Show me HTTP traffic for the last 7 days for example.com`
- `Show me which GraphQL datatype I need to use to query firewall events`
- `Can you generate a link to the Cloudflare GraphQL API Explorer with a pre-populated query and variables?`
- `I need to monitor HTTP requests and responses for a specific domain. Can you help me with that using the Cloudflare GraphQL API?`

## Connect to the MCP server

Connect your MCP client directly to `https://graphql.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.
