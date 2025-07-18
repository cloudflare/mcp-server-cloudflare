# Cloudflare DEX MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare DEX API](https://developers.cloudflare.com/api/resources/zero_trust/subresources/dex/) to provide visibility into device, network, and application performance across your Zero Trust organization

## 🔨 Available Tools

Currently available tools:

| **Category**                         | **Tool**                                   | **Description**                                                                                                                                        |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Synthetic Application Monitoring** | `dex_test_statistics`                      | Analyze Cloudflare DEX Test Results by quartile given a Test ID                                                                                        |
|                                      | `dex_list_tests`                           | List configured Cloudflare DEX tests along with overview performance metrics.                                                                          |
|                                      | `dex_http_test_details`                    | Retrieve detailed time series results for an HTTP DEX test by id.                                                                                      |
|                                      | `dex_traceroute_test_details`              | Retrieve detailed time series results for a Traceroute DEX test by id.                                                                                 |
|                                      | `dex_traceroute_test_network_path`         | Retrieve detailed time series results for the network path of a traceroute test by test id and device id.                                              |
|                                      | `dex_traceroute_test_result_network_path`  | Retrieve the hop-by-hop network path for a specific Traceroute DEX test result by id. Use `dex_traceroute_test_network_path` to obain test result ids. |
| **Remote Captures**                  | `dex_list_remote_capture_eligible_devices` | Retrieve a list of devices eligible for remote captures like packet captures or WARP diagnostics.                                                      |
|                                      | `dex_create_remote_capture`                | Initiate a remote capture on a specific device by id.                                                                                                  |
|                                      | `dex_list_remote_captures`                 | Retrieve a list of previously created remote captures along with their details and status.                                                             |
|                                      | `dex_list_remote_warp_diag_contents`       | List the filenames included in a remote WARP diag capture returned by `dex_list_remote_captures`.                                                      |
|                                      | `dex_explore_remote_warp_diag_output`      | Retreive remote WARP diag file contents by filepath returned by `dex_list_remote_warp_diag_contents`.                                                  |
| **Fleet Status**                     | `dex_fleet_status_live`                    | View live metrics for your fleet of zero trust devices for up to the past 1 hour.                                                                      |
|                                      | `dex_fleet_status_over_time`               | View historical metrics for your fleet of zero trust devices over time.                                                                                |
|                                      | `dex_fleet_status_logs`                    | View historical logs for your fleet of zero trust devices for up to the past 7 days.                                                                   |
|                                      | `dex_list_warp_change_events`              | View logs of users toggling WARP connection or changing configuration.                                                                                 |
| **Misc**                             | `dex_list_colos`                           | List Cloudflare colos, optionally sorted by their frequency of appearance in DEX test or fleet status results.                                         |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Are there any anomolies in the DEX test to the internal wiki in the past 24 hours?`
- `Can you see any bottlenecks in user@cloudflare.com's network path for Zoom today between 1 and 2 PM?`
- `How many macOS devices are connected right now in DFW?`
- `Do you notice any unusual performance metrics for user@cloudflare.com's device in the past few hours?`
- `Capture a WARP diag for user@cloudflare.com and make sure to test all routes`
- `Which users have toggled off WARP recently?`
- `Which Cloudflare colo is most used by my users in the EU running DEX application tests?`
- `Look at the latest WARP diag for user@cloudflare.com and tell me if you see anything notable in dns logs`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://dex.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://dex.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
