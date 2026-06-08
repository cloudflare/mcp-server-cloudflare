---
"@repo/mcp-common": patch
---

Handle malformed direct API-token requests as structured client auth responses, use credential ownership prefixes to avoid unnecessary identity probes while retaining Wrangler OAuth and legacy compatibility, preserve rate-limit backoff, and downgrade expected authentication failures from error logging.
