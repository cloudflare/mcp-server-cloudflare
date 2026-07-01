---
'cloudflare-browser-mcp-server': patch
---

Fix `start_crawl` tool `depth` parameter validation: the REST `/crawl` endpoint requires `depth >= 1`, but the MCP tool schema allowed `depth: 0`, producing a confusing downstream 400 instead of a clear local validation error. Schema now uses `.min(1)`.
