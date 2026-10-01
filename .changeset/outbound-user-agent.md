---
'@repo/mcp-common': patch
'cloudflare-blog': patch
'cloudflare-radar-mcp-server': patch
'dex-analysis': patch
'graphql-mcp-server': patch
---

Send `User-Agent: mcp-server-cloudflare` on every outbound request to Cloudflare: the Cloudflare SDK client, `fetchCloudflareApi`, the OAuth token exchange and refresh, the identity probe, and the direct `fetch` calls in the Radar, URL Scanner, GraphQL, DEX, Blog and docs tools.
