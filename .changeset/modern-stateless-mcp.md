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
'docs-autorag': patch
'docs-vectorize': patch
'graphql-mcp-server': patch
'logpush': patch
'cloudflare-radar-mcp-server': patch
'containers-mcp': patch
'workers-bindings': patch
'workers-builds': patch
'workers-observability': patch
'@repo/mcp-common': patch
'@repo/mcp-observability': patch
'@repo/eval-tools': patch
---

Migrate all MCP servers to fresh SDK v2 factories with default stateless 2025 compatibility, request-scoped auth/context, and no live protocol Durable Object or SSE session state. Preserve append-only Durable Object migration history while explicitly deleting retired protocol classes, preserve application/security state, require exact OAuth resource matching, bound MCP request bodies, and require explicit Workers Builds identifiers.
