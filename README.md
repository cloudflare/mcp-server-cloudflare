# Cloudflare MCP Server

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, you can find several MCP servers allowing you to connect to Cloudflare's service from an MCP client (e.g. Cursor, Claude) and use natural language to accomplish tasks through your Cloudflare account.

These MCP servers allow your [MCP Client](https://modelcontextprotocol.io/clients) to read configurations from your account, process information, make suggestions based on data, and even make those suggested changes for you. All of these actions can happen across Cloudflare's many services including application development, security and performance. 

They support both the `streamble-http` transport via `/mcp` and the `sse` transport (deprecated) via `/sse`.

The following servers are included in this repository:

| Server Name                                                    | Description                                                                                     | Server URL                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [**Documentation server**](/apps/docs-vectorize)               | Get up to date reference information on Cloudflare                                              | `https://docs.mcp.cloudflare.com/mcp`          |
| [**Workers Bindings server**](/apps/workers-bindings)          | Build Workers applications with storage, AI, and compute primitives                             | `https://bindings.mcp.cloudflare.com/mcp`      |
| [**Workers Builds server**](/apps/workers-builds)              | Get insights and manage your Cloudflare Workers Builds                                          | `https://builds.mcp.cloudflare.com/mcp`        |
| [**Observability server**](/apps/workers-observability)        | Debug and get insight into your application's logs and analytics                                | `https://observability.mcp.cloudflare.com/mcp` |
| [**Radar server**](/apps/radar)                                | Get global Internet traffic insights, trends, URL scans, and other utilities                    | `https://radar.mcp.cloudflare.com/mcp`         |
| [**Container server**](/apps/sandbox-container)                | Spin up a sandbox development environment                                                       | `https://containers.mcp.cloudflare.com/mcp`    |
| [**Browser rendering server**](/apps/browser-rendering)        | Fetch web pages, convert them to markdown and take screenshots                                  | `https://browser.mcp.cloudflare.com/mcp`       |
| [**Logpush server**](/apps/logpush)                            | Get quick summaries for Logpush job health                                                      | `https://logs.mcp.cloudflare.com/mcp`          |
| [**AI Gateway server**](/apps/ai-gateway)                      | Search your logs, get details about the prompts and responses                                   | `https://ai-gateway.mcp.cloudflare.com/mcp`    |
| [**AutoRAG server**](/apps/autorag)                            | List and search documents on your AutoRAGs                                                      | `https://autorag.mcp.cloudflare.com/mcp`       |
| [**Audit Logs server**](/apps/auditlogs)                       | Query audit logs and generate reports for review                                                | `https://auditlogs.mcp.cloudflare.com/mcp`     |
| [**DNS Analytics server**](/apps/dns-analytics)                | Optimize DNS performance and debug issues based on current set up                               | `https://dns-analytics.mcp.cloudflare.com/mcp` |
| [**Digital Experience Monitoring server**](/apps/dex-analysis) | Get quick insight on critical applications for your organization                                | `https://dex.mcp.cloudflare.com/mcp`           |
| [**Cloudflare One CASB server**](/apps/cloudflare-one-casb)    | Quickly identify any security misconfigurations for SaaS applications to safeguard users & data | `https://casb.mcp.cloudflare.com/mcp`          |
| [**GraphQL server**](/apps/graphql/)                           | Get analytics data using Cloudflare’s GraphQL API                                               | `https://graphql.mcp.cloudflare.com/mcp`       |

## Access the remote MCP server from any MCP client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL directly within its interface (e.g. [Cloudflare AI Playground](https://playground.ai.cloudflare.com/))

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using mcp-remote (https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

```json
{
	"mcpServers": {
		"cloudflare-observability": {
			"command": "npx",
			"args": ["mcp-remote", "https://observability.mcp.cloudflare.com/mcp"]
		},
		"cloudflare-bindings": {
			"command": "npx",
			"args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/mcp"]
		}
	}
}
```

## Using Cloudflare's MCP servers from the OpenAI Responses API

To use one of Cloudflare's MCP servers with [OpenAI's responses API](https://openai.com/index/new-tools-and-features-in-the-responses-api/), you will need to provide the Responses API with an API token that has the scopes (permissions) required for that particular MCP server.

For example, to use the [Browser Rendering MCP server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/browser-rendering) with OpenAI, create an API token in the Cloudflare dashboard [here](https://dash.cloudflare.com/profile/api-tokens), with the following permissions:

<img width="937" alt="Screenshot 2025-05-21 at 10 38 02 AM" src="https://github.com/user-attachments/assets/872e253f-23ce-43b3-983c-45f9d0f66100" />

## Need access to more Cloudflare tools?

We're continuing to add more functionality to this remote MCP server repo. If you'd like to leave feedback, file a bug or provide a feature request, [please open an issue](https://github.com/cloudflare/mcp-server-cloudflare/issues/new/choose) on this repository

## Troubleshooting

"Claude's response was interrupted ... "

If you see this message, Claude likely hit its context-length limit and stopped mid-reply. This happens most often on servers that trigger many chained tool calls such as the observability server.

To reduce the chance of running in to this issue:

- Try to be specific, keep your queries concise.
- If a single request calls multiple tools, try to to break it into several smaller tool calls to keep the responses short.

## Paid Features

Some features may require a paid Cloudflare Workers plan. Ensure your Cloudflare account has the necessary subscription level for the features you intend to use.

## Contributing

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
