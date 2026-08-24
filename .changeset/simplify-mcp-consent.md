---
'@repo/mcp-common': patch
---

Reduce the MCP client consent interstitial to the information required by the MCP security guidance: the requesting client name, full registered redirect URI, complete third-party scope set, and explicit approval controls. Preserve the signed consent cookie, CSRF validation, restrictive CSP, and OAuth state binding.
