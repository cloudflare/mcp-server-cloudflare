# MCP Common

Shared stateless MCP SDK v2 infrastructure for the Cloudflare MCP Workers.

## Server lifecycle

`createCloudflareMcpHandler()` wraps the Agents preview `createMcpHandler(factory)` API. It creates a fresh `@modelcontextprotocol/server` instance for every modern request and every request handled by the default stateless 2025 fallback.

```ts
import { z } from 'zod'

import { createCloudflareMcpHandler } from '@repo/mcp-common/src/server'

const handler = createCloudflareMcpHandler<Env>({
	serverInfo: ({ env }) => ({
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
	requireAuth: true,
	register(context) {
		context.server.registerTool('whoami', { inputSchema: z.object({}) }, async () => ({
			content: [{ type: 'text', text: context.props?.type ?? 'anonymous' }],
		}))
	},
	handler: {
		allowedHostnames: ['mcp.example.com'],
		allowedOriginHostnames: ['app.example.com'],
		corsOptions: { origin: 'https://app.example.com' },
	},
})

export default handler
```

Do not construct a global MCP server. Do not set `legacy: 'reject'`: the default `legacy: 'stateless'` fallback is part of the migration contract. The shared handler accepts only `POST` and CORS `OPTIONS` on the MCP route; standalone stream and session-deletion methods return `405`. MCP request bodies are capped at 4 MiB before SDK parsing, and OAuth resources use strict path-aware matching.

## Request context

The registration callback receives one immutable `McpRegistrationContext` containing:

- Worker `env`
- validated auth `props`
- an `AccountManager` derived from those props
- the original `Request`
- `ExecutionContext` and a bound `waitUntil`
- SDK factory context (`era` and verified `AuthInfo`)
- request-local Sentry and metrics clients when configured
- the fresh `CloudflareMCPServer`

Shared tools capture this context instead of a stateful server object. Account-scoped tools use `context.server.accountTool()` with a `z.object(...)` input schema. Account selection is resolved anew on every request: auth-pinned account, then `cf-account-id`, then the `account_id` argument.

## Authentication routing

`createCloudflareOAuthRouter()` keeps OAuth grants, KV, credentials, refresh tokens, and API-token validation as application/security state while routing only `/mcp` to the stateless handler. It exposes no compatibility transport route.

The OAuth Provider preview in the workspace catalog carries verified provider token metadata into the Agents preview. SDK callbacks receive standard `ctx.http.authInfo`; application props remain available in `McpRegistrationContext.props`. Do not log either raw token.

The default CORS allow-headers list includes `cf-account-id`, `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name`. Browser deployments must configure explicit Host and Origin hostname allowlists for their domains. Authenticated deployments pass those same lists as `createCloudflareOAuthRouter({ mcpRequestPolicy: ... })`, which rejects invalid MCP Host/Origin values before authentication and lets the MCP handler own `/mcp` preflights.
