# workers-bindings

## 0.4.3

### Patch Changes

- Updated dependencies [7fc3f18]
  - @repo/mcp-common@0.20.1

## 0.4.2

### Patch Changes

- 847fc1f: Update cloudflare-oauth-handler
- Updated dependencies [f9f0bb6]
- Updated dependencies [847fc1f]
  - @repo/mcp-common@0.20.0
  - @repo/mcp-observability@0.32.4
  - @repo/eval-tools@0.32.4

## 0.4.1

### Patch Changes

- 43f493d: Update agent + modelcontextprotocol deps
- Updated dependencies [43f493d]
  - @repo/mcp-observability@0.32.3
  - @repo/eval-tools@0.32.3
  - @repo/mcp-common@0.19.3

## 0.4.0

### Minor Changes

- dee0a7b: Updated the model for docs search to embeddinggemma-300m

## 0.3.4

### Patch Changes

- 24dd872: feat: Add MCP tool titles and hints to all Cloudflare tools
- Updated dependencies [24dd872]
  - @repo/eval-tools@0.32.2
  - @repo/mcp-common@0.19.2

## 0.3.3

### Patch Changes

- dffbd36: Use proper wrangler deploy in all servers so we get the name and version

## 0.3.2

### Patch Changes

- 7422e71: Update MCP sdk
- Updated dependencies [7422e71]
  - @repo/mcp-observability@0.32.2
  - @repo/mcp-common@0.19.1

## 0.3.1

### Patch Changes

- cc6d41f: Update agents deps & modelcontextprotocol
- Updated dependencies [1833c6d]
- Updated dependencies [cc6d41f]
  - @repo/mcp-common@0.19.0
  - @repo/eval-tools@0.32.1
  - @repo/mcp-observability@0.32.1

## 0.3.0

### Minor Changes

- f885d07: Add search docs tool to bindings and obs servers

### Patch Changes

- Updated dependencies [f885d07]
  - @repo/mcp-common@0.18.0

## 0.2.0

### Minor Changes

- 2621557: Use new workers:read scope instead of workers:write, as these mcp servers don't require workers write permissions

### Patch Changes

- Updated dependencies [83e2d19]
  - @repo/mcp-common@0.17.1

## 0.1.0

### Minor Changes

- 6cf52a6: Support AOT tokens

### Patch Changes

- 0fc4439: Update agents and modelcontext dependencies
- Updated dependencies [6cf52a6]
- Updated dependencies [0fc4439]
  - @repo/mcp-observability@0.32.0
  - @repo/eval-tools@0.32.0
  - @repo/mcp-common@0.17.0

## 0.0.3

### Patch Changes

- 3677a18: Remove extraneous log
- Updated dependencies [3677a18]
  - @repo/mcp-common@0.16.3

## 0.0.2

### Patch Changes

- 86c2e4f: Add API token passthrough auth
- Updated dependencies [86c2e4f]
  - @repo/mcp-common@0.16.2

## 0.0.1

### Patch Changes

- cf3771b: chore: add suffixes to common files in apps and packages

  It can be confusing switching between 16 files named 'index.ts', or 3 files named workers.ts. This change renames common files to have suffixes such as .types.ts, .api.ts, etc. to make it easier to work across files in the monorepo.

- Updated dependencies [cf3771b]
  - @repo/mcp-common@0.16.1
  - @repo/eval-tools@0.31.1
  - @repo/mcp-observability@0.31.1
