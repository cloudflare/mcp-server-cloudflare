# Cloudflare Developer Stack MCP Server 🧰

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that gives coding agents fresh, cited documentation for a **curated Cloudflare developer stack**. It's backed by Cloudflare AI Search and queried through the `ai_search_namespaces` binding.

## 🔨 Tools

The server exposes two read-only tools, one to discover what's available and one to search it:

| Tool               | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `list_libraries`   | List the documentation libraries this server can search (slug, name, source, description).     |
| `search_dev_stack` | Search across the stack (or one `library`), returning cited doc chunks with their source URLs. |

## 📚 Libraries

The stack spans Cloudflare's own docs, API, blog, and community, plus popular tools used alongside them. Each library maps to a `?libs=` slug you can use to scope the server (see below):

| `?libs=` slug          | Library                   | Source                        |
| ---------------------- | ------------------------- | ----------------------------- |
| `cloudflare`           | Cloudflare Developer Docs | developers.cloudflare.com     |
| `cloudflare-api`       | Cloudflare API            | developers.cloudflare.com/api |
| `cloudflare-blog`      | Cloudflare Blog           | blog.cloudflare.com           |
| `cloudflare-community` | Cloudflare Community      | community.cloudflare.com      |
| `vite`                 | Vite                      | vite.dev                      |
| `vitest`               | Vitest                    | vitest.dev                    |
| `astro`                | Astro                     | docs.astro.build              |
| `opennext`             | OpenNext                  | opennext.js.org               |
| `replicate`            | Replicate                 | replicate.com                 |
| `hono`                 | Hono                      | hono.dev                      |

## 🔎 Scoping with `?libs=`

The `/mcp` endpoint accepts a `libs` query param to scope the server to a subset of the stack (using the slugs above), e.g.:

```
https://stack.mcp.cloudflare.com/mcp?libs=cloudflare,hono,vite
```

When scoped, `list_libraries` and `search_dev_stack` (including its `library` enum) only expose the selected libraries, and cross-stack search is limited to them. Unknown slugs are ignored, and an empty or all-invalid `libs` falls back to the whole stack.

Scoping is read from the connection URL on every request, so it applies whether the client connects to `/mcp` or the `/sse` alias.

## Connect to the remote MCP server

Connect an MCP client directly to `https://stack.mcp.cloudflare.com/mcp` using Streamable HTTP. The `/sse` path serves the same stateless transport for backward compatibility.

```json
{
	"mcpServers": {
		"cloudflare-stack": {
			"url": "https://stack.mcp.cloudflare.com/mcp"
		}
	}
}
```
