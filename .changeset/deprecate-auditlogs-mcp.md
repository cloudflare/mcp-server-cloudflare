---
'auditlogs': patch
---

Deprecate the dedicated Audit Logs MCP server in favor of the Cloudflare API MCP server at https://mcp.cloudflare.com/mcp. The replacement covers Audit Logs v2 filters and cursor pagination through the full Cloudflare API.

The existing tool continues to work for now. The server exposes migration guidance through MCP instructions and is no longer advertised in the root server list or `server.json`.
