# Workers Builds MCP Server 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools to provide insights and management capabilities for your Cloudflare Workers Builds.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. Every tool call names its Worker or build explicitly; OAuth remains durable security state, but no active selection, MCP protocol session, or protocol Durable Object is retained.

## 🔨 Available Tools

Currently available tools:

| **Category**       | **Tool**                        | **Description**                                                                          |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Workers Builds** | `workers_builds_list_builds`    | Lists builds for a Cloudflare Worker.                                                    |
| **Workers Builds** | `workers_builds_get_build`      | Retrieves details for a specific build by its UUID, including build and deploy commands. |
| **Workers Builds** | `workers_builds_get_build_logs` | Fetches the logs for a Cloudflare Workers build by its UUID.                             |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List the last 5 builds for my worker 'my-ci-worker'.`
- `What were the details for build 'xxxx-xxxx-xxxx-xxxx'?`
- `Show me the logs for build 'xxxx-xxxx-xxxx-xxxx'.`
- `Did the latest build for worker frontend-app succeed?`

## Connect to the MCP server

Connect your MCP client directly to `https://builds.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
