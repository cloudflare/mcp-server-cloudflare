---
'@repo/mcp-common': patch
---

fix(mcp-common): flatten ToolAnnotations objects passed to `agent.server.tool`

The 4th argument to `McpServer.tool()` is `ToolAnnotations` itself; nesting
`annotations: { readOnlyHint: true }` inside that argument produces a
double-nested `tool.annotations.annotations.readOnlyHint` on the wire,
which spec-compliant clients cannot read.

This flattens all 29 call sites across `packages/mcp-common/src/tools/*.tools.ts`
so hint flags appear at `tool.annotations.readOnlyHint` /
`tool.annotations.destructiveHint` as the spec requires.
