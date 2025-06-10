# @repo/mcp-common

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
