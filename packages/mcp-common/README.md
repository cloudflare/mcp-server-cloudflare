# MCP Common

Shared stateless MCP SDK v2 infrastructure for the Cloudflare MCP Workers.

## Application assembly

Use `createPublicMcpApp()` or `createAuthenticatedMcpApp()` for application entrypoints. These modules centralize the invariants shared by every deployment:

- server name and version from `MCP_SERVER_NAME` and `MCP_SERVER_VERSION`
- request and tool metrics through `MCP_METRICS`
- localhost Host/Origin policy
- the Cloudflare MCP playground Origin policy
- a fresh SDK v2 server for every request
- the default stateless 2025 compatibility path
- OAuth and API-token routing for authenticated applications

```ts
import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['example-staging.mcp.cloudflare.com', 'example.mcp.cloudflare.com'],
	scopes: ExampleScopes,
	register(context) {
		context.registerTool('whoami', { inputSchema: z.object({}) }, async () => ({
			content: [{ type: 'text', text: context.props?.type ?? 'anonymous' }],
		}))
	},
})

export const mcpHandler = app.mcpHandler
export default app.worker
```

`mcpHandler` is exposed separately for transport-contract tests that bypass OAuth routing. Applications with a genuine custom route, such as an asset fallback, can call it directly from their own Worker `fetch` implementation.

For lower-level use, `createCloudflareMcpHandler()` accepts explicit server metadata, observability factories, and HTTP policy. Do not construct a global MCP server. Do not set `legacy: 'reject'`: the default `legacy: 'stateless'` fallback is part of the migration contract.

The shared handler accepts only `POST` and CORS `OPTIONS` on the MCP route. Standalone stream and session-deletion methods return `405`. MCP request bodies are capped at 4 MiB before SDK parsing, and OAuth resources use strict path-aware matching.

## Request registration context

The registration callback receives one request-local `McpRegistrationContext` containing:

- Worker `env`
- validated auth `props`
- the original `Request`
- `ExecutionContext` and a bound `waitUntil`
- SDK request context (`era` and optional caller-supplied `AuthInfo`)
- tracked `registerTool()` and `accountTool()` methods
- `registerPrompt()` and `recordError()` methods

The raw SDK server stays private. This prevents application registration code from bypassing shared tool metrics, error reporting, or account selection accidentally.

Shared tools capture the registration context instead of a stateful server object. Account-scoped tools use `context.accountTool()` with a `z.object(...)` input schema. Account selection is resolved anew on every request: auth-pinned account, then `cf-account-id`, then the `account_id` argument.

## Authentication routing

`createAuthenticatedMcpApp()` composes `createCloudflareOAuthRouter()` internally. OAuth grants, KV, credentials, refresh tokens, and API-token validation remain application/security state; only MCP protocol sessions are removed. No compatibility transport route is exposed.

The published OAuth Provider supplies validated application props through `ctx.props`; the Agents handler exposes those as `McpRegistrationContext.props`. SDK `ctx.http.authInfo` is optional and is present only when a compatible caller supplies it. Do not log raw tokens or authentication props.

The default CORS allow-headers list includes `cf-account-id`, `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name`. Browser deployments use the canonical explicit Host and Origin allowlists assembled from each application's `serviceHostnames`.
