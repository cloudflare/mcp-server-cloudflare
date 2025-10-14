# Model Context Protocol (MCP) Server + Cloudflare Documentation (via Autorag)

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections. It connects to an autorag instance (in this case, Cloudflare docs)

To run this server, you'll need access to an autorag instance which has indexed the contents of cloudflare-docs: https://github.com/cloudflare/cloudflare-docs/

The Cloudflare account this worker is deployed on already has this Autorag instance setup and indexed.

## Running locally

```
pnpm run start
```

Then connect to the server via remote MCP at `http://localhost:8976/mcp`

## Deploying

```
pnpm run deploy --env [ENVIRONMENT]
```
