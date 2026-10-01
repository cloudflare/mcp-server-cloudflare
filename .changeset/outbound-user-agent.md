---
'@repo/mcp-common': patch
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
---

Send `User-Agent: mcp-server-cloudflare/<server>` on every outbound request to Cloudflare, with `<server>` taken from the new `serverId` option of `createPublicMcpApp()` / `createAuthenticatedMcpApp()`. It covers the Cloudflare SDK client, `fetchCloudflareApi`, the OAuth token exchange and refresh, the identity probe, and the direct `fetch` calls in the Radar, URL Scanner, GraphQL, DEX, Blog and docs tools.
