# Setup

If you'd like to iterate and test your MCP server, you can do so in local development.

## Local Development

1. Create a `.dev.vars` file in your project root:

   If you're a Cloudflare employee:

   ```
   CLOUDFLARE_CLIENT_ID=your_development_cloudflare_client_id
   CLOUDFLARE_CLIENT_SECRET=your_development_cloudflare_client_secret
   ```

   If you're an external contributor, you can provide a development API token:

   ```
   DEV_DISABLE_OAUTH=true
   # This is your global api token
   DEV_CLOUDFLARE_API_TOKEN=your_development_api_token
   ```

2. Start the local development server:

   ```bash
   pnpm --filter unified dev
   ```

3. To test locally, open Inspector, and connect to `http://localhost:8976/mcp`.
   Once you follow the prompts, you'll be able to "List Tools". You can also connect with any MCP client.
