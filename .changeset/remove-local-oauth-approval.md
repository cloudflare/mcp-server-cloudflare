---
'@repo/mcp-common': patch
---

Remove the redundant MCP-hosted client approval page and redirect authorization requests directly to Cloudflare's consent dialog, which now identifies the client and supports selecting optional OAuth scopes.
