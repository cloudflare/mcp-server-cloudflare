---
'workers-observability': patch
---

Return `query_worker_observability` events that have no `$workers.outcome`, such as cron invocations and `console.log` lines, instead of rejecting the whole response. Unknown event types and execution models no longer reject the response either.
