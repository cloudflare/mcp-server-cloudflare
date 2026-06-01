---
'cloudflare-ai-gateway-mcp-server': patch
'cloudflare-autorag-mcp-server': patch
'cloudflare-browser-mcp-server': patch
'cloudflare-casb-mcp-server': patch
'cloudflare-radar-mcp-server': patch
'graphql-mcp-server': patch
'workers-observability': patch
'workers-bindings': patch
'workers-builds': patch
'containers-mcp': patch
'dex-analysis': patch
'dns-analytics': patch
'docs-ai-search': patch
'docs-autorag': patch
'docs-vectorize': patch
'auditlogs': patch
'logpush': patch
---

Upgrade `@cloudflare/workers-oauth-provider` 0.4.0 → 0.7.0.

No tool or behavior changes. The only API change affecting this repo is that
`TokenExchangeCallbackOptions` now carries a required `grantId` field, which only
touched a test fixture (the provider supplies it at runtime).
