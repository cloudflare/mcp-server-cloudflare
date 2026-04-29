---
'@repo/mcp-common': patch
---

fix(mcp-common): allow `workflow` `eventType` and treat `wallTimeMs`/`cpuTimeMs` as optional in observability response schema

The Workers Observability response schema (`zCloudflareMiniEvent` / `zCloudflareEvent` in `packages/mcp-common/src/types/workers-logs.types.ts`) was missing `'workflow'` from the `eventType` enum, and `zCloudflareEvent` re-declared `cpuTimeMs` / `wallTimeMs` as required. Cloudflare Workflow events emit `eventType: "workflow"` and do not always include the time fields, so the workers-observability MCP's `query_worker_observability` tool would reject any response containing a workflow event with a Zod validation error and return no data to the caller.

This left the MCP unable to surface logs from any Worker built on Cloudflare Workflows. Adding `'workflow'` to the enum and making the time fields optional unblocks those queries.
