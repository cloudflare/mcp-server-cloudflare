# @repo/eval-tools

## 0.32.6

### Patch Changes

- 1df6213: Migrate all MCP servers to fresh SDK v2 factories with default stateless 2025 compatibility, request-scoped auth/context, and no live protocol Durable Object or SSE session state. Upgrade the released MCP stack to `agents@0.20.1`, `@modelcontextprotocol/server@2.0.0`, `@modelcontextprotocol/client@2.0.0`, and SDK v1 compatibility package `@modelcontextprotocol/sdk@1.30.0`, using the isolated `agents/mcp/server` stateless handler. Keep `/sse` as a URL alias for the same Streamable HTTP handler as `/mcp`, without retaining the deprecated HTTP+SSE transport. Assemble every deployment through canonical public/authenticated app modules, prune obsolete app-level routing dependencies, and expose a tracked registration context instead of the raw SDK server. Preserve append-only Durable Object migration history while explicitly deleting retired protocol classes, preserve application/security state, upgrade the OAuth provider to 0.8.2 with exact resource matching, bound MCP request bodies, and require explicit Workers Builds identifiers.

## 0.32.5

### Patch Changes

- 99e2282: Move docs MCP server to use AI Search

## 0.32.4

### Patch Changes

- 847fc1f: Update cloudflare-oauth-handler

## 0.32.3

### Patch Changes

- 43f493d: Update agent + modelcontextprotocol deps

## 0.32.2

### Patch Changes

- 24dd872: feat: Add MCP tool titles and hints to all Cloudflare tools

## 0.32.1

### Patch Changes

- cc6d41f: Update agents deps & modelcontextprotocol

## 0.32.0

### Minor Changes

- 6cf52a6: Support AOT tokens

### Patch Changes

- 0fc4439: Update agents and modelcontext dependencies
