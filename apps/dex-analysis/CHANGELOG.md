# dex-analysis

## 0.0.2

### Patch Changes

- cf3771b: chore: add suffixes to common files in apps and packages

  It can be confusing switching between 16 files named 'index.ts', or 3 files named workers.ts. This change renames common files to have suffixes such as .types.ts, .api.ts, etc. to make it easier to work across files in the monorepo.

- Updated dependencies [cf3771b]
  - @repo/mcp-common@0.16.1
  - @repo/mcp-observability@0.31.1
