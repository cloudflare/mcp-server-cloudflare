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
'demo-day': patch
---

Upgrade core dependencies: `agents` 0.2.19 → 0.13.3, `@modelcontextprotocol/sdk` 1.20.2 →
1.29.0, `zod` 3 → 4, and `ai` 4 → 6.

No user-facing tool or behavior changes. Internal adjustments for the new versions:
- `zod` 4: `z.record(...)` now takes an explicit key schema; `z.string().ip()` replaced with
  `z.ipv4()`/`z.ipv6()` validation; dropped the removed `objectOutputType` helper.
- `agents` 0.13: `McpAgent` env generic is constrained to `Cloudflare.Env`.
- MCP SDK 1.29: tool `annotations` hints must be flat (`{ title, readOnlyHint, ... }`) — fixes a
  latent bug where nested hints were silently ignored.
- `ai` 6: eval tooling updated (`LanguageModel`, `inputSchema`, `stopWhen`/`stepCountIs`, tool-call `input`).
