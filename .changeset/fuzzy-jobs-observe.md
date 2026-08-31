---
'workers-observability': patch
---

Allow Workers Observability event responses without `$workers.outcome` so cron-triggered Worker events can be queried. Clarify that cron telemetry uses `cron` as its `$metadata.origin` value.
