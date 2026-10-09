# Container MCP Server

This is a simple MCP-based interface for a sandboxed development environment.

## Local dev

`wrangler dev` runs the sandbox in Docker, so the Docker daemon must be running.

Do the following from within the sandbox-container app:

1. Copy the `.dev.vars.example` file to a new `.dev.vars` file.
2. Get the Cloudflare client id and secret from a team member and add them to the `.dev.vars` file.
3. Run `pnpm i` then `pnpm dev` to start the MCP server.
4. Run `pnpx @modelcontextprotocol/inspector` to start the MCP inspector client.
5. Open the inspector client in your browser and connect to the server via `http://localhost:8976/mcp`.

The first `container_initialize` builds the template snapshot, which takes about a minute. Later sandboxes start from it in under a second.

## Deploying

CI deploys staging on every push to `main` and production on release. There is no image to build: sandboxes use the Cloudflare-managed `cloudflare/debian-trixie` image.

## Changing the sandbox toolchain

Edit `TEMPLATE_SETUP` in `server/sandboxTemplate.ts` and bump `TEMPLATE_VERSION`. The next `container_initialize` after the deploy builds a new snapshot; running containers keep their old one until they restart. Bump `TEMPLATE_VERSION` too when you want a newer `cloudflare/debian-trixie`, since a snapshot keeps the image it was built from.

The Container applications use the `durable_object` scheduling policy, which can't be changed after an application is created.
