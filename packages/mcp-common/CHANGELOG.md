# @repo/mcp-common

## 0.20.2

### Patch Changes

- 99e2282: Move docs MCP server to use AI Search
- Updated dependencies [99e2282]
  - @repo/mcp-observability@0.32.5

## 0.20.1

### Patch Changes

- 7fc3f18: Update cloudflare oauth handler 2

## 0.20.0

### Minor Changes

- f9f0bb6: Be explicit in oauth error messages

### Patch Changes

- 847fc1f: Update cloudflare-oauth-handler
- Updated dependencies [847fc1f]
  - @repo/mcp-observability@0.32.4

## 0.19.3

### Patch Changes

- 43f493d: Update agent + modelcontextprotocol deps
- Updated dependencies [43f493d]
  - @repo/mcp-observability@0.32.3

## 0.19.2

### Patch Changes

- 24dd872: feat: Add MCP tool titles and hints to all Cloudflare tools

## 0.19.1

### Patch Changes

- 7422e71: Update MCP sdk
- Updated dependencies [7422e71]
  - @repo/mcp-observability@0.32.2

## 0.19.0

### Minor Changes

- 1833c6d: add relative timeframe support for querying

### Patch Changes

- cc6d41f: Update agents deps & modelcontextprotocol
- Updated dependencies [cc6d41f]
  - @repo/mcp-observability@0.32.1

## 0.18.0

### Minor Changes

- f885d07: Add search docs tool to bindings and obs servers

## 0.17.1

### Patch Changes

- 83e2d19: Pass in type user_token in props during oauth flow

## 0.17.0

### Minor Changes

- 6cf52a6: Support AOT tokens

### Patch Changes

- 0fc4439: Update agents and modelcontext dependencies
- Updated dependencies [6cf52a6]
- Updated dependencies [0fc4439]
  - @repo/mcp-observability@0.32.0

## 0.16.3

### Patch Changes

- 3677a18: Remove extraneous log

## 0.16.2

### Patch Changes

- 86c2e4f: Add API token passthrough auth

## 0.16.1

### Patch Changes

- cf3771b: chore: add suffixes to common files in apps and packages

  It can be confusing switching between 16 files named 'index.ts', or 3 files named workers.ts. This change renames common files to have suffixes such as .types.ts, .api.ts, etc. to make it easier to work across files in the monorepo.

  - @repo/mcp-observability@0.31.1
