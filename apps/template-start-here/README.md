# Model Context Protocol (MCP) Server + Cloudflare OAuth

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections, with Cloudflare OAuth built-in.

You should use this as a template to build an MCP server for Cloudflare, provided by Cloudflare at `server-name.mcp.cloudflare.com`. It has a basic set of tools `apps/template-start-here/src/tools/logs.ts` — you can modify these to do what you need

## Getting Started


- Set secrets via Wrangler (ask in the `Cloudflare's Own MCP Servers` internal channel to get credentials)

```bash
wrangler secret put CLOUDFLARE_CLIENT_ID
wrangler secret put CLOUDFLARE_CLIENT_SECRET
```

#### Set up a KV namespace

- Create the KV namespace:
  `wrangler kv:namespace create "OAUTH_KV"`
- Update the Wrangler file with the KV ID

#### Deploy & Test

Deploy the MCP server to make it available on your workers.dev domain
` wrangler deploy`

Test the remote server using [Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```
npx @modelcontextprotocol/inspector@latest
```

## Deploying to production

- You will need to liberate the zone (LTZ) for your `<server-name>.mcp.cloudflare.com`
