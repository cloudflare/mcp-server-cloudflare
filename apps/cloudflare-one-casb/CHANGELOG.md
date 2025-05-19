# cloudflare-casb-mcp-server

## 0.0.4

### Patch Changes

- 3677a18: Remove extraneous log
- Updated dependencies [3677a18]
  - @repo/mcp-common@0.16.3

## 0.0.3

### Patch Changes

- 86c2e4f: Add API token passthrough auth
- Updated dependencies [86c2e4f]
  - @repo/mcp-common@0.16.2

## 0.0.2

### Patch Changes

- cf3771b: chore: add suffixes to common files in apps and packages

  It can be confusing switching between 16 files named 'index.ts', or 3 files named workers.ts. This change renames common files to have suffixes such as .types.ts, .api.ts, etc. to make it easier to work across files in the monorepo.

- Updated dependencies [cf3771b]
  - @repo/mcp-common@0.16.1
