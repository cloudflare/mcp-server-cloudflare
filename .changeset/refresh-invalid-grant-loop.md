---
"@repo/mcp-common": patch
"auditlogs": patch
"cloudflare-ai-gateway-mcp-server": patch
"cloudflare-autorag-mcp-server": patch
"cloudflare-browser-mcp-server": patch
"cloudflare-casb-mcp-server": patch
"cloudflare-radar-mcp-server": patch
"containers-mcp": patch
"dex-analysis": patch
"dns-analytics": patch
"docs-ai-search": patch
"docs-vectorize": patch
"graphql-mcp-server": patch
"logpush": patch
"workers-bindings": patch
"workers-builds": patch
"workers-observability": patch
---

Guard upstream refresh-token exchanges against invalid-grant retry storms, cache terminal refresh failures, and revoke downstream grants when the upstream refresh token is permanently invalid.
