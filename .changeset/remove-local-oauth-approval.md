---
'@repo/mcp-common': patch
---

Remove the redundant MCP-hosted client approval page and redirect authorization requests directly to Cloudflare's consent dialog. Request every scope configured for the server so Cloudflare can identify required scopes and let the user decline optional scopes.
