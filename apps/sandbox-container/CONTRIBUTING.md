# Container MCP Server

This is a simple MCP-based interface for a sandboxed development environment.

## Local dev

Cloudchamber local dev isn't implemented yet, so we are doing a bit of a hack to just run the server in your local environment. Because of this, testing the container(s) and container manager locally is not possible at this time.

Do the following from within the sandbox-container app:

1. Copy the `.dev.vars.example` file to a new `.dev.vars` file.
2. Get the Cloudflare client id and secret from a team member and add them to the `.dev.vars` file.
3. Run `pnpm i` then `pnpm dev` to start the MCP server.
4. Run `pnpx @modelcontextprotocol/inspector` to start the MCP inspector client.
5. Open the inspector client in your browser and connect to the server via `http://localhost:8976/mcp`.

Note: Temporary files created through files tool calls are stored in the workdir folder of this app.

## Deploying

1. Make sure the docker daemon is running

2. Disable WARP and run

```
npx https://prerelease-registry.devprod.cloudflare.dev/workers-sdk/runs/14387504770/npm-package-wrangler-8740 deploy
```

3. Add to your Claude config. If using with Claude, you'll need to disable WARP:

```
{
    "mcpServers": {
        "container": {
            "command": "npx",
            "args": [
                "mcp-remote",
                // this is my deployed instance
                "https://container-starter-2.cmsparks.workers.dev/mcp"
            ]
        }
    }
}
```
