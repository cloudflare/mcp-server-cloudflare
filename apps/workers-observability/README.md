# Workers Observability MCP Server 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by [Workers Observability](https://developers.cloudflare.com/workers/observability/) to debug
and get insight into your Workers' logs and analytics.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth and application search bindings remain durable application/security state; no MCP protocol session or protocol Durable Object is retained.

## 🔨 Available Tools

Currently available tools:

| **Category**          | **Tool**                     | **Description**                                                                                                                                                            |
| --------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers Analytics** | `query_worker_observability` | Queries Workers Observability API to analyze logs and metrics from your Cloudflare Workers. Supports listing events, calculating metrics, and finding specific invocations |
| **Schema Discovery**  | `observability_keys`         | Discovers available data fields in your Workers logs including metadata fields, worker-specific fields, and custom logged fields                                           |
| **Value Exploration** | `observability_values`       | Finds available values for specific fields in Workers logs to help build precise filters for analytics queries                                                             |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Can you tell me about any potential issues on this particular worker 'my-worker-name'?`
- `Show me the CPU time usage for my worker 'api-gateway' over the last 24 hours`
- `What were the top 5 countries by request count for my worker yesterday?`
- `How many requests were made to my worker 'my-app' broken down by HTTP status code?`
- `Compare the error rates between my production and staging workers`

## Connect to the MCP server

Connect your MCP client directly to `https://observability.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
