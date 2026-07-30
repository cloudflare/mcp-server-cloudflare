# cloudflare-blog

## 0.2.2

### Patch Changes

- Updated dependencies [4e1e6ab]
  - @repo/mcp-common@0.20.8

## 0.2.1

### Patch Changes

- 1df6213: Migrate all MCP servers to fresh SDK v2 factories with default stateless 2025 compatibility, request-scoped auth/context, and no live protocol Durable Object or SSE session state. Upgrade the released MCP stack to `agents@0.20.1`, `@modelcontextprotocol/server@2.0.0`, `@modelcontextprotocol/client@2.0.0`, and SDK v1 compatibility package `@modelcontextprotocol/sdk@1.30.0`, using the isolated `agents/mcp/server` stateless handler. Keep `/sse` as a URL alias for the same Streamable HTTP handler as `/mcp`, without retaining the deprecated HTTP+SSE transport. Assemble every deployment through canonical public/authenticated app modules, prune obsolete app-level routing dependencies, and expose a tracked registration context instead of the raw SDK server. Preserve append-only Durable Object migration history while explicitly deleting retired protocol classes, preserve application/security state, upgrade the OAuth provider to 0.8.2 with exact resource matching, bound MCP request bodies, and require explicit Workers Builds identifiers.
- Updated dependencies [1df6213]
  - @repo/mcp-common@0.20.7

## 0.2.0

### Minor Changes

- 502ce24: Add the Cloudflare Blog MCP server (`blog.mcp.cloudflare.com`). Exposes tools to search posts via semantic search, list posts (with tag filtering and pagination), get a single post by slug, and list all tags.

### Patch Changes

- Updated dependencies [cb01861]
  - @repo/mcp-common@0.20.6
