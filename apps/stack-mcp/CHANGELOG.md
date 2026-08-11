# stack-mcp

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
