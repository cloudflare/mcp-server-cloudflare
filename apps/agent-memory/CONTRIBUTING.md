# Setup

If you'd like to iterate and test your MCP server, you can do so in local development.

## Local Development

1. Create a `.dev.vars` file in your project root (see `.dev.vars.example`):

   If you're a Cloudflare employee:

   ```
   CLOUDFLARE_CLIENT_ID=your_development_cloudflare_client_id
   CLOUDFLARE_CLIENT_SECRET=your_development_cloudflare_client_secret
   ```

   If you're an external contributor, you can provide a development API token:

   ```
   DEV_DISABLE_OAUTH=true
   # Use an API token with Account Read, Workers R2 Storage Write, and Workers AI permissions.
   DEV_CLOUDFLARE_API_TOKEN=your_development_api_token
   ```

2. Start the local development server:

   ```bash
   npx wrangler dev
   ```

3. To test locally, open Inspector and connect to `http://localhost:8990/mcp`.
   Once you follow the prompts, you'll be able to "List Tools". You can also connect with any MCP client.

## Storage & inference are billed to the selected account

This server intentionally uses R2 and Workers AI in the selected Cloudflare account via the REST API rather than
Worker bindings. The first write creates the account-scoped `agent-memory-mcp` bucket if it does not already exist;
account members with the required permissions share its memory and search index.

The OAuth scopes requested include `account:read`, `workers:write` (which grants R2 object access), and `ai:write` in
addition to the shared `RequiredScopes`.

## Deploying the Worker ( Cloudflare employees only )

Set secrets via Wrangler:

```bash
npx wrangler secret put CLOUDFLARE_CLIENT_ID -e <ENVIRONMENT>
npx wrangler secret put CLOUDFLARE_CLIENT_SECRET -e <ENVIRONMENT>
```

## Set up a KV namespace

Create the KV namespace:

```bash
npx wrangler kv namespace create "OAUTH_KV"
```

Then, update the Wrangler file with the generated KV namespace ID.

## Deploy & Test

Deploy the MCP server to make it available on your workers.dev domain:

```bash
npx wrangler deploy -e <ENVIRONMENT>
```

Test the remote server using [Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector@latest
```
