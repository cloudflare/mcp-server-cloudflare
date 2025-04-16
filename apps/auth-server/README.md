# Auth Server

This server is responsible for handling callbacks from Cloudflare oauth flow, and then redirecting them to a whitelisted server's callback URL e.g workers/observability/oauth/callback.

This simplifies the oauth authentication implementation for MCP servers within this monorepo, as each MCP server simply needs to be added to the whitelisted callback url list and then each server can handle the forwarded callback from auth-server.

Note: In development, the auth-server is not needed, as each server (e.g workers/observability) will simply handle the callback on the <http://localhost:8976/oauth/callback> endpoint.
