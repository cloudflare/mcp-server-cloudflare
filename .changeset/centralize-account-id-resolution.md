---
'cloudflare-ai-gateway-mcp-server': minor
'cloudflare-autorag-mcp-server': minor
'cloudflare-browser-mcp-server': minor
'cloudflare-casb-mcp-server': minor
'cloudflare-radar-mcp-server': minor
'graphql-mcp-server': minor
'workers-observability': minor
'workers-bindings': minor
'workers-builds': minor
'dex-analysis': minor
'dns-analytics': minor
'auditlogs': minor
'logpush': minor
---

Centralize Cloudflare account resolution and remove the account-management tools.

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
