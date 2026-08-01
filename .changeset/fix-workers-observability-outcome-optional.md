---
'@repo/mcp-common': patch
---

fix(mcp-common): make `outcome` optional in the Workers Observability response schema

`zCloudflareMiniEvent` (`packages/mcp-common/src/types/workers-logs.types.ts`) required every event to carry `outcome`, but `outcome` only describes a whole invocation and is absent on the `console.log` lines emitted inside one. Because `query_worker_observability` validates the entire event array in a single `.parse()`, any response containing one of these non-invocation events was rejected outright and the tool returned no logs at all. `outcome` is now optional so responses with a mix of invocation and non-invocation events parse correctly.
