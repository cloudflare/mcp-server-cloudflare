# cloudflare-browser-mcp-server

## 0.2.0

### Minor Changes

- f625075: Centralize Cloudflare account resolution and remove the account-management tools.

  The `accounts_list` and `set_active_account` tools are removed. Account scoping is now
  resolved automatically by an `AccountManager` (via the new `server.accountTool()`
  registration), in priority order:

  1. **Auth-pinned account** — an account-scoped API token's account, or an OAuth token with a
     single account, is used automatically (no `account_id` parameter is exposed).
  2. **`cf-account-id` request header** — for tokens that can access multiple accounts, set this
     header in your MCP client config to pick an account.
  3. **`account_id` tool argument** — for multi-account tokens, account-scoped tools expose an
     optional `account_id` parameter; when omitted (and no header is set) the tool returns an
     error listing the accounts you can use. Multi-account credentials also list their accounts
     in the server's `initialize` instructions.

  All tool error responses now set `isError: true` so clients can distinguish failures.

### Patch Changes

- a358e69: Upgrade `@cloudflare/workers-oauth-provider` 0.4.0 → 0.7.0.

  No tool or behavior changes. The only API change affecting this repo is that
  `TokenExchangeCallbackOptions` now carries a required `grantId` field, which only
  touched a test fixture (the provider supplies it at runtime).

- f625075: Upgrade core dependencies: `agents` 0.2.19 → 0.13.3, `@modelcontextprotocol/sdk` 1.20.2 →
  1.29.0, `zod` 3 → 4, and `ai` 4 → 6.

  No user-facing tool or behavior changes. Internal adjustments for the new versions:

  - `zod` 4: `z.record(...)` now takes an explicit key schema; `z.string().ip()` replaced with
    `z.ipv4()`/`z.ipv6()` validation; dropped the removed `objectOutputType` helper.
  - `agents` 0.13: `McpAgent` env generic is constrained to `Cloudflare.Env`.
  - MCP SDK 1.29: tool `annotations` hints must be flat (`{ title, readOnlyHint, ... }`) — fixes a
    latent bug where nested hints were silently ignored.
  - `ai` 6: eval tooling updated (`LanguageModel`, `inputSchema`, `stopWhen`/`stepCountIs`, tool-call `input`).

## 0.1.12

### Patch Changes

- Updated dependencies [f77355c]
  - @repo/mcp-common@0.20.5

## 0.1.11

### Patch Changes

- 50926ec: Bump @cloudflare/workers-oauth-provider to ^0.4.0, add resourceMatchOriginOnly migration flag and 30-day refresh token TTL
- Updated dependencies [50926ec]
  - @repo/mcp-common@0.20.4

## 0.1.10

### Patch Changes

- Updated dependencies [01a172e]
  - @repo/mcp-common@0.20.3

## 0.1.9

### Patch Changes

- 99e2282: Move docs MCP server to use AI Search
- Updated dependencies [99e2282]
  - @repo/mcp-common@0.20.2
  - @repo/mcp-observability@0.32.5

## 0.1.8

### Patch Changes

- Updated dependencies [7fc3f18]
  - @repo/mcp-common@0.20.1

## 0.1.7

### Patch Changes

- 847fc1f: Update cloudflare-oauth-handler
- Updated dependencies [f9f0bb6]
- Updated dependencies [847fc1f]
  - @repo/mcp-common@0.20.0
  - @repo/mcp-observability@0.32.4

## 0.1.6

### Patch Changes

- 43f493d: Update agent + modelcontextprotocol deps
- Updated dependencies [43f493d]
  - @repo/mcp-observability@0.32.3
  - @repo/mcp-common@0.19.3

## 0.1.5

### Patch Changes

- 24dd872: feat: Add MCP tool titles and hints to all Cloudflare tools
- Updated dependencies [24dd872]
  - @repo/mcp-common@0.19.2

## 0.1.4

### Patch Changes

- 7422e71: Update MCP sdk
- Updated dependencies [7422e71]
  - @repo/mcp-observability@0.32.2
  - @repo/mcp-common@0.19.1

## 0.1.3

### Patch Changes

- cc6d41f: Update agents deps & modelcontextprotocol
- Updated dependencies [1833c6d]
- Updated dependencies [cc6d41f]
  - @repo/mcp-common@0.19.0
  - @repo/mcp-observability@0.32.1

## 0.1.2

### Patch Changes

- Updated dependencies [f885d07]
  - @repo/mcp-common@0.18.0

## 0.1.1

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
  - @repo/mcp-common@0.17.0

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
  - @repo/mcp-observability@0.31.1
