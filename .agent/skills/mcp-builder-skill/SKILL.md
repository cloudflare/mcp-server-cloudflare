---
name: mcp-builder-skill
description: 'Expert guidance for building, testing, and deploying Model Context Protocol (MCP) servers with the Cloudflare stack'
tags: [mcp, model-context-protocol, cloudflare, workers, typescript]
---

# MCP Builder Skill

## Overview

This skill provides expert guidance for building, testing, deploying, and managing **Model Context Protocol (MCP) servers** on the Cloudflare platform. It covers the full lifecycle: from server initialization through tool registration, testing, deployment to Workers, and production monitoring.

**Use this skill when:**
- Building new MCP servers or tools
- Integrating with Cloudflare Workers, KV, Durable Objects
- Debugging MCP protocol issues (SSE, JSON-RPC)
- Setting up OAuth authentication for MCP servers
- Testing MCP servers locally and in production
- Deploying to multiple environments (staging/prod)

---

## Part 1: MCP Server Architecture

### Core Concepts

**MCP Server**: A JSON-RPC 2.0 service that exposes tools, resources, and prompts to AI clients.

**Core Components:**
```typescript
// 1. Server initialization
const server = new Server({
  name: "my-mcp-server",
  version: "1.0.0"
})

// 2. Tool registration
server.tool(
  "tool_name",
  { schema: {...} },  // Zod schema
  async (params) => { /* implementation */ }
)

// 3. Transport setup
// SSE: Server-Sent Events (HTTP)
// Stdio: Standard input/output (CLI)
// WebSocket: Real-time bidirectional
```

**MCP Protocol Flow:**
```
Client → initialize() → Server responds with capabilities
     ↓
Client → call tools/resources → Server processes request
     ↓
Client ← Server responds with result
```

### Recommended Stack for Cloudflare

```typescript
// packages/mcp-common/src/mcp-app.ts (shared base)
import { Server } from "@modelcontextprotocol/server"
import { SSEServerTransport } from "@modelcontextprotocol/server/sse"
import { createHono } from "hono"

// HTTP framework: Hono (lightweight, Cloudflare Workers compatible)
const app = createHono()

// Transport: SSE (Server-Sent Events over HTTP)
app.post("/mcp", SSEServerTransport.middleware(server))

// Auth: Cloudflare OAuth Provider
import { CloudflareOAuthProvider } from "@cloudflare/workers-oauth-provider"
```

---

## Part 2: Building an MCP Server Step-by-Step

### Step 1: Initialize Project Structure

```bash
# Use mise for tool management
mise run setup

# Create new MCP app in monorepo
mkdir -p apps/my-mcp-server/src

cd apps/my-mcp-server
cat > package.json << 'EOF'
{
  "name": "my-mcp-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "@repo/mcp-common": "workspace:*",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.18.6",
    "typescript": "^5.5.4",
    "vitest": "^4.1.8",
    "wrangler": "^4.96.0"
  }
}
EOF
```

### Step 2: Define Tool Schemas with Zod

```typescript
// src/tools/schema.ts
import { z } from "zod"

// Define what parameters the tool accepts
export const myToolSchema = z.object({
  query: z.string().describe("Search query"),
  limit: z.number().int().min(1).max(100).default(10),
})

export type MyToolInput = z.infer<typeof myToolSchema>
```

### Step 3: Register Tools

```typescript
// src/tools/my-tool.ts
import { MCPContext } from "@repo/mcp-common"
import { myToolSchema, MyToolInput } from "./schema"

export function registerMyTools(context: MCPContext) {
  context.server.tool(
    "my_search_tool",
    {
      description: "Search for information",
      inputSchema: myToolSchema,
    },
    async (input: MyToolInput) => {
      try {
        const results = await performSearch(input.query, input.limit)
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
              isError: true,
            },
          ],
        }
      }
    }
  )
}
```

### Step 4: Create the MCP App

```typescript
// src/index.ts
import { createAuthenticatedMcpApp } from "@repo/mcp-common"
import { registerMyTools } from "./tools/my-tool"

const app = createAuthenticatedMcpApp({
  name: "my-mcp-server",
  version: "0.1.0",
  
  // OAuth scopes required
  scopes: {
    "account:read": "Read account information",
    "api:read": "Read API data",
  },
  
  // Server instructions visible to clients
  serverOptions: {
    instructions: `# My MCP Server
    
This server provides tools for searching and analyzing data.

## Available Tools
- my_search_tool: Search for information
- my_analysis_tool: Analyze results
    `,
  },
  
  // Register all tools
  register(context) {
    registerMyTools(context)
  },
})

// Export for Cloudflare Workers
export default app.worker
export const mcpHandler = app.mcpHandler
```

### Step 5: Local Development with Wrangler

```bash
# Create wrangler.toml
cat > wrangler.toml << 'EOF'
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-12-19"

[env.development]
name = "my-mcp-server-dev"
route = "https://dev.my-mcp.workers.dev/*"

[env.staging]
route = "https://staging.my-mcp.workers.dev/*"

[env.production]
route = "https://my-mcp.workers.dev/*"

[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-kv-id"

[triggers.crons]
crons = ["0 */6 * * *"]  # Every 6 hours
EOF

# Start dev server
mise run dev:app -- my-mcp-server
# or directly:
wrangler dev
```

**Connect with MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector@latest
# Connect to: http://localhost:8976/mcp
```

---

## Part 3: Authentication & Authorization

### OAuth Setup with Cloudflare

```typescript
// src/auth/oauth.ts
import { 
  CloudflareOAuthProvider,
  TokenExchangeCallbackOptions,
} from "@cloudflare/workers-oauth-provider"

export function setupOAuth(env: Env) {
  const provider = new CloudflareOAuthProvider({
    clientId: env.CLOUDFLARE_CLIENT_ID,
    clientSecret: env.CLOUDFLARE_CLIENT_SECRET,
    redirectUri: `${env.ORIGIN}/oauth/callback`,
  })

  return provider
}

// Token exchange for MCP server
export async function exchangeToken(
  code: string,
  env: Env,
): Promise<string> {
  const provider = setupOAuth(env)
  const token = await provider.exchangeCode(code)
  return token.accessToken
}
```

### Account Management (Cloudflare API)

```typescript
// src/auth/accounts.ts
import { Cloudflare } from "cloudflare"

export class AccountManager {
  private client: Cloudflare

  constructor(apiToken: string) {
    this.client = new Cloudflare({ apiToken })
  }

  async getCurrentAccount() {
    return await this.client.accounts.list()
  }

  async hasAccountAccess(accountId: string) {
    const accounts = await this.getCurrentAccount()
    return accounts.some(acc => acc.id === accountId)
  }
}
```

---

## Part 4: Testing MCP Servers

### Unit Tests with Vitest

```typescript
// src/tools/my-tool.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { createTestContext } from "@repo/mcp-common/testing"
import { registerMyTools } from "./my-tool"

describe("My Tool", () => {
  let context: MCPContext

  beforeEach(() => {
    context = createTestContext()
    registerMyTools(context)
  })

  it("should search and return results", async () => {
    const tool = context.server.tools.find(t => t.name === "my_search_tool")
    
    const result = await tool.handler({
      query: "test",
      limit: 5,
    })

    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe("text")
  })

  it("should handle errors gracefully", async () => {
    const tool = context.server.tools.find(t => t.name === "my_search_tool")
    
    const result = await tool.handler({
      query: "", // Invalid: empty query
      limit: 1,
    })

    expect(result.content[0].isError).toBe(true)
  })
})
```

### Integration Tests

```typescript
// src/integration.test.ts
import { describe, it, expect } from "vitest"
import { testEnvironment } from "cloudflare:test"

describe("MCP Server Integration", () => {
  it("should initialize and return capabilities", async () => {
    const request = new Request("http://localhost:8976/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      }),
    })

    const response = await testEnvironment.fetch(request)
    const data = await response.json()

    expect(data.result).toBeDefined()
    expect(data.result.capabilities).toBeDefined()
  })
})
```

**Run tests:**
```bash
mise run test
mise run test:watch  # Watch mode
mise run test:coverage  # Coverage report
```

---

## Part 5: Deployment Pipeline

### Environment Configuration

```toml
# wrangler.toml
[env.staging]
vars = { API_BASE_URL = "https://api-staging.example.com" }
route = "https://staging.my-mcp.workers.dev/*"

[env.production]
vars = { API_BASE_URL = "https://api.example.com" }
route = "https://my-mcp.workers.dev/*"
routes = [
  { pattern = "my-mcp.workers.dev/*", zone_name = "example.com" }
]
```

### Deploy Commands

```bash
# Deploy to staging
mise run deploy:staging
# or: pnpm deploy:staging

# Deploy to production
mise run deploy:prod
# Includes: typecheck → build → test → deploy

# Verify deployment
mise run deploy:verify
curl https://my-mcp.workers.dev/mcp/initialize | jq .
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy-mcp.yml
name: Deploy MCP Server

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
      - run: mise run validate:all
      - run: mise run test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
      - run: mise run deploy:staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## Part 6: Common Patterns & Best Practices

### Error Handling Pattern

```typescript
export async function safeToolCall<T>(
  fn: () => Promise<T>,
  toolName: string,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    console.error(`Error in ${toolName}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Usage:
context.server.tool("my_tool", schema, async (params) => {
  const result = await safeToolCall(
    () => externalApiCall(params),
    "my_tool"
  )
  
  return {
    content: [{
      type: "text",
      text: result.success 
        ? JSON.stringify(result.data)
        : `Error: ${result.error}`,
      isError: !result.success,
    }],
  }
})
```

### Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import { RateLimiter } from "@repo/mcp-common"

const limiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => req.user?.id || req.ip,
})

app.use(limiter.middleware)
```

### Caching Tool Results

```typescript
// src/cache/cache.ts
import { Cache } from "@repo/mcp-common"

const cache = new Cache({ ttl: 3600 }) // 1 hour

context.server.tool("cached_tool", schema, async (params) => {
  const cacheKey = `tool:${JSON.stringify(params)}`
  const cached = await cache.get(cacheKey)
  
  if (cached) return cached

  const result = await expensiveOperation(params)
  await cache.set(cacheKey, result)
  
  return result
})
```

### Monitoring & Logging

```typescript
// src/observability/logger.ts
import { logger } from "@repo/mcp-common"

context.server.hook("beforeToolCall", (toolName, params) => {
  logger.info("Tool called", { toolName, params })
})

context.server.hook("afterToolCall", (toolName, result) => {
  logger.info("Tool completed", { toolName, duration: result.duration })
})
```

---

## Part 7: Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Tool not found** | Tool not registered | Check `registerMyTools()` is called in MCP app |
| **Schema validation fails** | Invalid Zod schema | Test schema with `schema.parse(data)` |
| **OAuth redirect fails** | Incorrect redirect URI | Verify `wrangler.toml` route matches config |
| **SSE connection closes** | Client disconnected | Implement reconnect logic in client |
| **Performance timeout** | Tool takes too long | Optimize query, add caching, use async generators |

### Debug Commands

```bash
# Check server initialization
curl -X POST http://localhost:8976/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# List available tools
curl -X POST http://localhost:8976/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'

# Check logs in Cloudflare
wrangler tail --env staging

# Local debug with environment variables
DEBUG=* wrangler dev
```

---

## Part 8: Reference Resources

### Key Files to Review
- **Server Template**: `packages/mcp-common/src/mcp-app.ts`
- **Example Server**: `apps/workers-builds/src/`
- **Test Utils**: `packages/mcp-common/src/testing/`
- **OAuth Config**: `apps/*/src/auth/oauth.ts`

### External Resources
- [MCP Spec](https://spec.modelcontextprotocol.io/)
- [SDK Docs](https://modelcontextprotocol.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Inspector Tool](https://modelcontextprotocol.io/docs/tools/inspector)

### Mise Tasks for MCP Development

```bash
mise run dev              # Start all MCP servers
mise run test             # Run all tests
mise run validate:all     # Format, lint, types, deps
mise run deploy:staging   # Deploy to staging
mise run build            # Build all packages
mise run health           # Full health check
```

---

## Quick Start Checklist

- [ ] Create project structure: `mkdir apps/my-mcp-server`
- [ ] Define tool schemas with Zod
- [ ] Implement tool handlers
- [ ] Register tools in MCP app
- [ ] Create `wrangler.toml` with OAuth config
- [ ] Write unit tests with Vitest
- [ ] Test locally: `wrangler dev` + Inspector
- [ ] Setup CI/CD in `.github/workflows/`
- [ ] Deploy to staging: `mise run deploy:staging`
- [ ] Verify deployment
- [ ] Deploy to production: `mise run deploy:prod`

---

**For more help:**
- Review existing servers: `ls apps/`
- Check shared code: `ls packages/mcp-common/`
- Ask Copilot: `/skill mcp-builder-skill`
