# Cloudflare Logpush MCP Server 📜

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Logpush API](https://developers.cloudflare.com/logs/) to provide insights into Logpush jobs.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth remains durable security state; no MCP protocol session or protocol Durable Object is retained.

## 🔨 Available Tools

Currently available tools:

| **Category**                | **Tool**                     | **Description**                                                         |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Logpush Jobs By Account** | `logpush_jobs_by_account_id` | Fetches Logpush jobs by specific account or all accounts under the user |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Which Logpush jobs failed recently?`
- `Do any of my Logpush jobs in my <insert name> account have errors?`
- `Can you list all the enabled job failures from today?`

## Connect to the MCP server

Connect your MCP client directly to `https://logs.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.
