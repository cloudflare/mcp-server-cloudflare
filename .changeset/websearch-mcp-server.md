---
"websearch": minor
---

Add the Web Search MCP server (`websearch.mcp.cloudflare.com`). It is a stateless (`createMcpHandler`) server exposing only `/mcp`, with a `web_search` tool that takes an `account_id` parameter and is gated behind the `websearch.run` OAuth scope. Supports both OAuth and raw Cloudflare API token (Bearer) authentication.
