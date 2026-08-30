# Cloudflare Unified MCP Server 📡

This is a Model Context Protocol (MCP) server that supports remote MCP
connections, with Cloudflare OAuth built-in.
4/0AXEQxIAzM4zOWYSFbp69F5oZ73GT8B-1nEPXSMUyZmzAiRZMfN-xxuGSCq_RB1OrH85yLw
It combines tools from all other domain-specific MCP servers in this repository into a single, unified endpoint. This allows you to access a wide range of Cloudflare product tools without needing to connect to multiple servers.

## Connect to the MCP server

Connect your MCP client directly to `https://unified.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

The server exposes tools from the following products: AI Gateway, Audit Logs, Browser Rendering, Cloudflare Blog, Cloudflare One CASB, Demo Day, DNS Analytics, DEX, Docs AI Search, Logpush, Radar, Sandbox Container, Workers Bindings, Workers Builds, and Workers Observability.

Interested in contributing, and running this server locally? See CONTRIBUTING.md to get started.
