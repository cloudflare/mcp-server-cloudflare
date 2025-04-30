# Model Context Protocol (MCP) Server + Cloudflare Documentation (via Autorag)

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections. It connects to a Vectorize DB (in this case, indexed w/ the Cloudflare docs)

The Cloudflare account this worker is deployed on already has this Vectorize DB setup and indexed.

## Running locally

```
pnpm run start
```

Then connect to the server via remote MCP at `http://localhost:8976/sse`

## Deploying

```
pnpm run deploy --env [ENVIRONMENT]
```
