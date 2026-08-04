---
'cloudflare-ai-gateway-mcp-server': patch
'@repo/mcp-common': patch
---

Upgrade `@cloudflare/workers-oauth-provider` from 0.8.2 to 0.9.0. Migrate the AI Gateway authentication integration fixture from the implicit flow to a valid S256 authorization-code exchange.
