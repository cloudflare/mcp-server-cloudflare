# Cloudflare GraphQL MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in. It integrates tools powered by the [Cloudflare GraphQL API](https://developers.cloudflare.com/analytics/graphql-api/) to provide insights and utilities for your Cloudflare account.

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

## Access the remote MCP server from Claude Desktop

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://graphql.mcp.cloudflare.com/mcp`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://graphql.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.
