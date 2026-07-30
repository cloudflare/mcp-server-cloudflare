# Setup

> This server is deprecated. See [`README.md`](./README.md) for the migration path to [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp). Bug fixes are welcome, but new features should be proposed in the unified [`cloudflare/mcp`](https://github.com/cloudflare/mcp) repository.

You can run the server locally when maintaining existing behavior.

## Local development

1. Create a `.dev.vars` file in the project root.

   Cloudflare employees can use OAuth credentials:

   ```text
   CLOUDFLARE_CLIENT_ID=your_development_cloudflare_client_id
   CLOUDFLARE_CLIENT_SECRET=your_development_cloudflare_client_secret
   ```

   External contributors can use a development API token:

   ```text
   DEV_DISABLE_OAUTH=true
   DEV_CLOUDFLARE_API_TOKEN=your_development_api_token
   ```

2. Start the local development server:

   ```bash
   npx wrangler dev
   ```

3. Open the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) and connect to `http://localhost:8976/mcp`.

## Deploying the Worker (Cloudflare employees only)

Set secrets with Wrangler:

```bash
npx wrangler secret put CLOUDFLARE_CLIENT_ID -e <ENVIRONMENT>
npx wrangler secret put CLOUDFLARE_CLIENT_SECRET -e <ENVIRONMENT>
```

Create the OAuth KV namespace, then add its ID to `wrangler.jsonc`:

```bash
npx wrangler kv namespace create "OAUTH_KV"
```

Deploy the server:

```bash
npx wrangler deploy -e <ENVIRONMENT>
```
