---
"cloudflare-autorag-mcp-server": patch
---

Deprecate the AutoRAG MCP server. AutoRAG has been superseded by Cloudflare AI Search, which is covered by the unified Cloudflare MCP server at https://mcp.cloudflare.com/mcp (see https://github.com/cloudflare/mcp).

Tools continue to function. The server now exposes a migration guide via the MCP `instructions` field, and the `autorag.mcp.cloudflare.com` entries have been removed from `server.json` so registries stop advertising the deprecated server.

**Action required:** migrate to `https://mcp.cloudflare.com/mcp` at your earliest convenience.
