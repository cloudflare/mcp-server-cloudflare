---
'cloudflare-ai-gateway-mcp-server': patch
'auditlogs': patch
'cloudflare-autorag-mcp-server': patch
'cloudflare-browser-mcp-server': patch
'cloudflare-blog': patch
'cloudflare-casb-mcp-server': patch
'demo-day': patch
'dex-analysis': patch
'dns-analytics': patch
'docs-ai-search': patch
'graphql-mcp-server': patch
'logpush': patch
'cloudflare-radar-mcp-server': patch
'containers-mcp': patch
'stack-mcp': patch
'workers-bindings': patch
'workers-builds': patch
'workers-observability': patch
'@repo/mcp-common': patch
---

Return an actionable `410 Gone` Problem Details response when a client attempts the removed HTTP+SSE transport with `GET /sse`. The response explains that clients can configure the existing `/sse` URL to use Streamable HTTP or, preferably, move to `/mcp` for future compatibility. It preserves query parameters, identifies the recommended replacement in a `Link` header, and is available before OAuth authentication. Streamable HTTP `POST` requests continue to work on both `/sse` and `/mcp`.
