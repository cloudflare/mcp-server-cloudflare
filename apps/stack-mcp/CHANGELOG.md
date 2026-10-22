# stack-mcp

## 0.2.0

### Minor Changes

- dfd49e5: Retire the `/sse` URL and upgrade to `@cloudflare/workers-oauth-provider` 1.2.4.

  - Every request to `/sse` now returns `410 Gone` with an `application/problem+json` body naming the server's `/mcp` URL, before any authentication. `/sse` used to serve Streamable HTTP as an alias of `/mcp`; clients configured with it must switch to `/mcp`. MCP SDK v1 and v2 clients show the message in their connection error. It is not a redirect, because OAuth clients that follow one reject the `/mcp` protected resource metadata with an error that never mentions `/mcp`.
  - The OAuth protected resource is now `<origin>/mcp`, and every token is bound to it. Grants bound to `/mcp` keep working. Grants bound to `/sse`, or to the bare origin that 0.x advertised at the root metadata URL, fail their next refresh with `invalid_grant` (workers-oauth-provider 1.2.4), and the client signs in again at `/mcp`.
  - The consent page uses the provider's consent helpers. The authorization request stays server-side and the page posts only a single-use handle bound to the browser. Cancel now sends `access_denied` back to the MCP client. The page shows the redirect URI, the publishing domain of a Client ID Metadata Document client, and a warning when the tokens go to a local app.
  - Cloudflare sign-in uses `beginUpstream()` / `finishUpstream()` in place of the hand-rolled KV state and session cookie. Two tabs can authorize at once, and declining at Cloudflare sends `access_denied` back to the MCP client.
  - Remembered consent uses `isConsentRemembered()`. Approvals made before this change aren't carried over, so each browser sees the consent page once more.
  - Direct Cloudflare API tokens are validated for the `/mcp` resource.

### Patch Changes

- 0702829: A direct Cloudflare credential that Cloudflare rejects as expired or unknown (`403 9109: Invalid access token`) now gets `401 invalid_token`, as the MCP authorization spec requires for invalid or expired tokens. Before, it got `403 insufficient_scope`, which sends clients through a scope step-up instead of re-authenticating. A valid token that lacks access still gets `403 insufficient_scope`.
- Updated dependencies [0702829]
- Updated dependencies [dfd49e5]
  - @repo/mcp-common@0.21.0

## 0.1.6

### Patch Changes

- ab883e5: Send `User-Agent: mcp-server-cloudflare (<server>; +https://github.com/cloudflare/mcp-server-cloudflare)` on every outbound request to Cloudflare, with `<server>` taken from the new `serverId` option of `createPublicMcpApp()` / `createAuthenticatedMcpApp()`. It covers the Cloudflare SDK client, `fetchCloudflareApi`, the OAuth token exchange and refresh, the identity probe, and the direct `fetch` calls in the Radar, URL Scanner, GraphQL, DEX, Blog and docs tools.
- Updated dependencies [ab883e5]
  - @repo/mcp-common@0.20.11

## 0.1.5

### Patch Changes

- b9e6d76: Return an actionable `410 Gone` Problem Details response when a client attempts the removed HTTP+SSE transport with `GET /sse`. The response explains that clients can configure the existing `/sse` URL to use Streamable HTTP or, preferably, move to `/mcp` for future compatibility. It preserves query parameters, identifies the recommended replacement in a `Link` header, and is available before OAuth authentication. Streamable HTTP `POST` requests continue to work on both `/sse` and `/mcp`.
- Updated dependencies [b9e6d76]
  - @repo/mcp-common@0.20.10

## 0.1.4

### Patch Changes

- Updated dependencies [12a9a61]
  - @repo/mcp-common@0.20.9

## 0.1.3

### Patch Changes

- cf04d31: Rename the search tool from `search_docs` to `search_dev_stack`, and rewrite both tool descriptions.

## 0.1.2

### Patch Changes

- 955f0c0: Release the Developer Stack MCP server: a documentation-search MCP backed by Cloudflare AI Search that exposes a curated Cloudflare developer stack. Provides `search_docs` and `list_libraries` tools, with per-request scoping via the `?libs=` URL param.

## 0.1.1

### Patch Changes

- Updated dependencies [4e1e6ab]
  - @repo/mcp-common@0.20.8
