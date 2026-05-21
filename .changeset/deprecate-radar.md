---
"cloudflare-radar-mcp-server": patch
---

Deprecate the Radar MCP server. The unified Cloudflare MCP server at https://mcp.cloudflare.com/mcp already covers all Radar API endpoints via Code Mode (see https://github.com/cloudflare/mcp).

Tools continue to function. The server now exposes a deprecation notice via the MCP `instructions` field, and the `radar.mcp.cloudflare.com` entries have been removed from `server.json` so registries stop advertising the deprecated server.

**Action required:** migrate to `https://mcp.cloudflare.com/mcp` at your earliest convenience.
