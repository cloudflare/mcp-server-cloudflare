---
'@repo/mcp-common': patch
---

Delegate direct Cloudflare API-token and OAuth credential validation to the Workers OAuth Provider's resolveExternalToken hook on provider 0.10.1. Expected verification failures now become structured 401/403/429 responses with WWW-Authenticate challenges instead of escaping as Worker exceptions, verified identities are cached against a credential digest so repeat MCP requests skip the Cloudflare API probes, and authorize-endpoint validation failures redirect to validated client redirect URIs or render locally per OAuth 2.1.
