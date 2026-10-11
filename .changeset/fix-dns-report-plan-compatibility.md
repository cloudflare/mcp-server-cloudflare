---
'dns-analytics': patch
---

Fix `dns_report` tool failing with 403 on Free and Pro plan zones

The tool hardcoded `responseCached` in the dimensions list, which is gated to Business plan and above. Free and Pro accounts received:

```
"Response Cached is not available for your plan.
 Upgrade to the business plan to see DNS analytics by responseCached."
```

Removing `responseCached` from the default dimensions restores functionality for Free and Pro zones while keeping `responseCode` breakdown available to all plans. Business/Enterprise users who want `responseCached` analytics can query via the `cf-graphql` MCP server's `dnsAnalyticsAdaptiveGroups` dataset.
