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

A direct Cloudflare credential that Cloudflare rejects as expired or unknown (`403 9109: Invalid access token`) now gets `401 invalid_token`, as the MCP authorization spec requires for invalid or expired tokens. Before, it got `403 insufficient_scope`, which sends clients through a scope step-up instead of re-authenticating. A valid token that lacks access still gets `403 insufficient_scope`.
