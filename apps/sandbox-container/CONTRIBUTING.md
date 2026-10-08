# Container MCP Server

This is a simple MCP-based interface for a sandboxed development environment.

## Local dev

`wrangler dev` builds `Dockerfile` and runs the sandbox in Docker, so the Docker daemon must be running.

Do the following from within the sandbox-container app:

1. Copy the `.dev.vars.example` file to a new `.dev.vars` file.
2. Get the Cloudflare client id and secret from a team member and add them to the `.dev.vars` file.
3. Run `pnpm i` then `pnpm dev` to start the MCP server.
4. Run `pnpx @modelcontextprotocol/inspector` to start the MCP inspector client.
5. Open the inspector client in your browser and connect to the server via `http://localhost:8976/mcp`.

## Deploying

CI deploys staging on every push to `main` and production on release. `wrangler deploy` builds `Dockerfile` and pushes it as the `sandbox` image, so the deploy machine needs Docker.

The Container applications use the `durable_object` scheduling policy, which can't be changed after an application is created. `UserContainer` picks the image and instance size when it starts a container, so a new image reaches users the next time they call `container_initialize`; running containers keep their image.
