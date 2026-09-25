---
'workers-observability': patch
---

Accept Worker events without an `outcome`, such as cron-triggered invocations, in `query_worker_observability` responses.

Clarify that cron-triggered invocations use `cron`, not `scheduled`, as their `$metadata.origin` filter value.
