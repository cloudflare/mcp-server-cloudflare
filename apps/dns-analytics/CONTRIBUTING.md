# Setup

If you'd like to iterate and test your MCP server, you can do so in local development.

## Local Development

1. Create a `.dev.vars` file in your project root:

   If you're a Cloudflare employee:

   ```
   CLOUDFLARE_CLIENT_ID=your_development_cloudflare_client_id
   CLOUDFLARE_CLIENT_SECRET=your_development_cloudflare_client_secret
   DEV_CLOUDFLARE_API_TOKEN=your_development_api_token
   ```

   If you're an external contributor, you can provide a development API token (See [Cloudflare API](https://developers.cloudflare.com/api/) for information on creating an API Token):

   ```
   DEV_DISABLE_OAUTH=true
   DEV_CLOUDFLARE_EMAIL=your_cloudflare_email
   # This is your api token with endpoint access.
   DEV_CLOUDFLARE_API_TOKEN=your_development_api_token
   ```

2. Start the local development server:

   ```bash
   npx wrangler dev
   ```

3. To test locally, open Inspector, and connect to `http://localhost:8976/sse`.
   Once you follow the prompts, you'll be able to "List Tools". You can also connect with any MCP client.

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
