---
'@repo/mcp-common': minor
'cloudflare-ai-gateway-mcp-server': minor
'auditlogs': minor
'cloudflare-autorag-mcp-server': minor
'cloudflare-browser-mcp-server': minor
'cloudflare-blog': minor
'cloudflare-casb-mcp-server': minor
'demo-day': minor
'dex-analysis': minor
'dns-analytics': minor
'docs-ai-search': minor
'graphql-mcp-server': minor
'logpush': minor
'cloudflare-radar-mcp-server': minor
'containers-mcp': minor
'stack-mcp': minor
'workers-bindings': minor
'workers-builds': minor
'workers-observability': minor
---

Retire the `/sse` URL and upgrade to `@cloudflare/workers-oauth-provider` 1.2.1.

- Every request to `/sse` now returns `410 Gone` with an `application/problem+json` body naming the server's `/mcp` URL, before any authentication. `/sse` used to serve Streamable HTTP as an alias of `/mcp`; clients configured with it must switch to `/mcp`. MCP SDK v1 and v2 clients show the message in their connection error. It is not a redirect, because OAuth clients that follow one reject the `/mcp` protected resource metadata with an error that never mentions `/mcp`.
- The OAuth protected resource is now `<origin>/mcp`, and every token is bound to it. Grants bound to `/mcp` keep working. Grants bound to `/sse` fail their next refresh with `invalid_grant`, and the client signs in again at `/mcp`.
- The consent page uses the provider's consent helpers. The authorization request stays server-side and the page posts only a single-use handle bound to the browser. Cancel now sends `access_denied` back to the MCP client. The page shows the redirect URI, the publishing domain of a Client ID Metadata Document client, and a warning when the tokens go to a local app.
- Cloudflare sign-in uses `beginUpstream()` / `finishUpstream()` in place of the hand-rolled KV state and session cookie. Two tabs can authorize at once, and declining at Cloudflare sends `access_denied` back to the MCP client.
- Remembered consent uses `isConsentRemembered()`. Approvals made before this change aren't carried over, so each browser sees the consent page once more.
- Direct Cloudflare API tokens are validated for the `/mcp` resource.
