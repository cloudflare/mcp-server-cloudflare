---
"@repo/mcp-common": patch
---

Handle malformed direct API-token requests as client auth failures, map combined Cloudflare API 400 identity-probe responses to 401, and downgrade expected identity-probe auth failures from error logging.
