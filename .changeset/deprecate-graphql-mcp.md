---
"graphql-mcp-server": patch
---

Deprecate the dedicated GraphQL MCP server in favor of the Cloudflare API MCP server at https://mcp.cloudflare.com/mcp. The replacement supports GraphQL queries, variables, and schema introspection through Code Mode.

The existing tools continue to work for now. The server exposes the migration notice through MCP instructions and is no longer advertised in the root server list or `server.json`.
