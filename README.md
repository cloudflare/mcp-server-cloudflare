# Cloudflare MCP Server

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, we provide an installer as well as an MCP Server for [Cloudflare's API](https://api.cloudflare.com).

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things on your Cloudflare account, e.g.:

- `List all the Cloudflare workers on my <some-email>@gmail.com account.`
- `Can you tell me about any potential issues on this particular worker '...'?`

## Access the remote MCP server from Claude Desktop

Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.

Replace the content with the following configuration. Once you restart Claude Desktop, a browser window will open showing your OAuth login page. Complete the authentication flow to grant Claude access to your MCP server. After you grant access, the tools will become available for you to use.

```
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.cloudflare.com/workers/observability/sse"
      ]
    }
  }
}
```

## Need access to more Cloudflare tools?

We're gradually moving over functionality to this remote MCP server repo. In the meantime please take a look at the local only mcp-server-cloudflare package which currently has more tools available.

Visit <https://www.npmjs.com/package/@cloudflare/mcp-server-cloudflare>

## Paid Features

Some features may require a paid Cloudflare Workers plan. Ensure your Cloudflare account has the necessary subscription level for the features you intend to use.

## Features

### Workers Management

- `worker_list`: List all Workers in your account
- `worker_get_worker`: Get a Worker's script content

### Workers Logs

- `worker_logs_by_worker_name`: Analyze recent logs for a Cloudflare Worker by worker name
- `worker_logs_by_ray_id`: Analyze recent logs across all workers for a specific request by Cloudflare Ray ID
- `worker_logs_keys`: Get available telemetry keys for a Cloudflare Worker

## Developing

### Apps

- [workers-observability](apps/workers-observability/): The Workers Observability MCP server

### Packages

- eslint-config: Eslint config used by all apps and packages.
- typescript-config: tsconfig used by all apps and packages.
- mcp-common: Shared common tools and scripts to help manage this repo.

For more details on development in this monorepo, take a look at apps/workers-observability

## Testing

The project uses Vitest as the testing framework with MSW (Mock Service Worker) for API mocking.

### Running Tests

To run all tests:

```bash
pnpm test
```

To run a specific test file:

```bash
pnpm test -- tests/tools/queues.test.ts
```

To run tests in watch mode (useful during development):

```bash
pnpm test:watch
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
