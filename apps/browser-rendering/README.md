# Cloudflare Browser Run MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Browser Run API](https://developers.cloudflare.com/browser-run/) to fetch
web pages, convert them to markdown, and take screenshots.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth grants and token validation remain durable security state; the server stores no MCP protocol session. The Browser Run session tools below manage application-level browser sessions, not MCP protocol sessions.

## 🔨 Available Tools

Currently available tools:

| **Tool**                | **Description**                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `get_url_html_content`  | Retrieves the HTML content of the specified URL.                                    |
| `get_url_markdown`      | Fetches the webpage content and converts it into Markdown format.                   |
| `get_url_screenshot`    | Captures a screenshot of the webpage. Optionally, specify the viewport size.        |
| `get_url_pdf`           | Renders the webpage to a PDF document.                                              |
| `get_url_snapshot`      | Returns the page HTML content and a screenshot in a single call.                    |
| `scrape_url_elements`   | Scrapes elements from the page by CSS selector.                                     |
| `get_url_json`          | Extracts structured JSON from the page using AI. Supports a prompt and JSON schema. |
| `get_url_links`         | Returns the list of links on the page.                                              |
| `start_crawl`           | Starts an asynchronous crawl of a website and returns a `job_id`.                   |
| `get_crawl_result`      | Returns the status and records of a crawl job.                                      |
| `cancel_crawl`          | Cancels a running crawl job.                                                        |
| `list_browser_sessions` | Lists active Browser Run sessions for the account.                                  |
| `kill_browser_session`  | Closes (kills) a Browser Run session by its session ID.                             |

**Note:** These tools are account-scoped. Single-account credentials (and account-scoped API tokens) are detected automatically. If your credentials can access multiple accounts, pass `account_id` to the tool, or set a `cf-account-id` request header in your MCP client config.

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Get the HTML content of https://example.com.`
- `Convert https://example.com to Markdown.`
- `Take a screenshot of https://example.com.`
- `Render https://example.com to a PDF.`
- `Extract the product name and price from https://example.com as JSON.`
- `List all the links on https://example.com.`
- `Crawl https://example.com two levels deep and give me the results.`
- `List my active browser sessions and kill the oldest one.`

## Connect to the MCP server

Connect your MCP client directly to `https://browser.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
