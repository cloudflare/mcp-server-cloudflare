import { z } from 'zod'

import { fetchCloudflareApi } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import { getReader } from '../warp_diag_reader'

import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { ZodRawShape, ZodTypeAny } from 'zod'
import type { CloudflareDEXMCP } from '../dex-analysis.app'

export function registerDEXTools(agent: CloudflareDEXMCP) {
	registerTool({
		name: 'dex_test_statistics',
		description: 'Analyze Cloudflare DEX Test Results by quartile statistics for performance monitoring. Use when the user wants to examine network performance metrics, latency distributions, or connectivity test outcomes across different percentiles. Accepts `test_id` (required string identifier for the specific DEX test). e.g., test_id="abc123-def456-ghi789". Returns error if the test ID does not exist or access is denied. Do not use when you need to list available tests or create new ones (use other DEX tools instead).',
		schema: {
			testId: testIdParam.describe('The DEX Test ID to analyze details of.'),
			from: timeStartParam,
			to: timeEndParam,
		},
		llmContext:
			"The quartiles are sorted by 'resource fetch time' from LEAST performant in quartile 1 to MOST performant in quartile 4. For each quartile-based entry, it provides extensive information about the up-to-20 specific test results that are within that quartile of performance.",
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/test-results/by-quartile?${new URLSearchParams({ ...(params as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_tests',
		description: 'List all Cloudflare DEX Tests configured in your account. Use when the user wants to view, review, or audit existing digital experience monitoring tests. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `account_id` (optional, uses active account if not specified). e.g., returns tests monitoring website performance, API endpoints, or network connectivity. Raises an error if no active account is set or if DEX is not enabled for the account.',
		agent,
		schema: { page: pageParam },
		callback: async ({ accountId, accessToken, page }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/tests/overview?${new URLSearchParams({ page: String(page), per_page: '50' })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_http_test_details',
		description: 'Retrieve detailed time series performance metrics for a specific HTTP DEX test. Use when the user wants to analyze historical performance data, response times, or error rates for a particular test over time. Accepts `test_id` (required string identifier for the DEX test). e.g., test_id="abc123-def456-ghi789". Returns error if the test ID does not exist or access is denied. Do not use when you need to list all available DEX tests (use a general listing tool instead).',
		schema: {
			testId: testIdParam.describe('The HTTP DEX Test ID to get details for.'),
			deviceId: deviceIdParam
				.optional()
				.describe(
					"Optionally limit results to specific device(s). Can't be used in conjunction with the colo parameter."
				),
			colo: coloParam.optional(),
			from: timeStartParam,
			to: timeEndParam,
			interval: aggregationIntervalParam,
		},
		agent,
		callback: async ({ testId, accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/http-tests/${testId}?${new URLSearchParams({ ...(params as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_traceroute_test_details',
		description: 'Retrieve detailed time series results for a Traceroute DEX test by its unique identifier. Use when the user wants to analyze network path performance metrics, latency measurements, or hop-by-hop routing data over time. Accepts `test_id` (required string), e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479". Returns timestamped data points showing packet loss, response times, and routing paths. Raises an error if the test ID does not exist or access is denied. Do not use when you need to list all available DEX tests (use a list tests tool instead).',
		schema: {
			testId: testIdParam.describe('The traceroute DEX Test ID to get details for.'),
			deviceId: deviceIdParam
				.optional()
				.describe(
					"Optionally limit results to specific device(s). Can't be used in conjunction with the colo parameter."
				),
			colo: coloParam.optional(),
			timeStart: timeStartParam,
			timeEnd: timeEndParam,
			interval: aggregationIntervalParam,
		},
		agent,
		callback: async ({ testId, accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/traceroute-tests/${testId}?${new URLSearchParams({ ...(params as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_traceroute_test_network_path',
		description:
			'Retrieve aggregate network path data for a Traceroute DEX test by identifier. Use when the user wants to analyze overall network routing patterns, latency trends, or path stability across multiple test runs. Do not use when you need hop-by-hop details for individual test runs (use dex_traceroute_test_result_network_path instead). Accepts `test_id` (required string), e.g., "abc123-def456-ghi789". Returns error if the test ID does not exist or access is unauthorized.',
		schema: {
			testId: testIdParam.describe('The traceroute DEX Test ID to get network path details for.'),
			deviceId: deviceIdParam.describe('The ID of the device to get network path details for.'),
			from: timeStartParam,
			to: timeEndParam,
			interval: aggregationIntervalParam,
		},
		agent,
		callback: async ({ testId, accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/traceroute-tests/${testId}/network-path?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_traceroute_test_result_network_path',
		description:
			'Retrieve the hop-by-hop network path for a specific Traceroute DEX test result. Use when the user wants to analyze network routing, diagnose connectivity issues, or examine packet traversal details for a completed traceroute test. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `id` (required) - the unique identifier of the DEX test result. e.g., "abc123-def456-ghi789". Returns error if the test result ID does not exist or the test has not completed yet.',
		schema: {
			testResultId: z
				.string()
				.uuid()
				.describe('The traceroute DEX Test Result ID to get network path details for.'),
		},
		agent,
		callback: async ({ testResultId, accountId, accessToken }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/traceroute-test-results/${testResultId}/network-path`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_remote_capture_eligible_devices',
		description:
			"List devices eligible for remote network captures in your Cloudflare account. Use when the user wants to identify which devices can be monitored or debugged remotely for network analysis. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts no parameters - retrieves all eligible devices in the active account. Returns device identifiers and associated user email addresses required for initiating remote captures, e.g., devices with `device_id` like "abc123" and `user_email` like "user@example.com". Raises an error if no active account is set or if the account lacks DEX permissions. "abc123" and `user_email` like "user@company.com". Raises an error if no active account is set or if the account lacks DEX permissions. " +
			'response in order to create a remote capture for a specific device. It can also be used as a generic source to find ' +
			'devices registered to the account, filtering by user email if necessary.',
		schema: {
			page: pageParam,
			search: z.string().optional().describe('Filter devices by name or email.'),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands/devices?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}&per_page=50`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_create_remote_pcap',
		description:
			'Create a remote packet capture (PCAP) file for network traffic analysis on a target device. Use when the user wants to diagnose network issues, monitor traffic patterns, or investigate connectivity problems on remote systems. Accepts `device_id` (required), `duration` (optional, in seconds), and `filter` (optional, BPF expression). e.g., device_id="server-01", duration=300, filter="port 80". This is a resource-intensive operation that may impact device performance. Raises an error if the device is offline or lacks sufficient storage space. Do not use when you need to analyze existing PCAP files (use appropriate analysis tools instead).' +
			'Always ask for confirmation from the user that the targeted email and device are correct before executing a capture',
		schema: {
			device_id: z.string().uuid().describe('The device ID to target.'),
			user_email: z.string().email().describe('The email of the user associated with the device.'),
			'max-file-size-mb': z
				.number()
				.min(1)
				.default(5)
				.optional()
				.describe(
					'Maximum file size in MB for the capture file. Specifies the maximum file size of the warp-daig zip artifact that can be uploaded. ' +
						'If the zip artifact exceeds the specified max file size it will NOT be uploaded.'
				),
			'packet-size-bytes': z
				.number()
				.min(1)
				.default(160)
				.optional()
				.describe('Maximum number of bytes to save for each packet.'),
			'time-limit-min': z
				.number()
				.min(1)
				.default(5)
				.describe('Limit on capture duration in minutes'),
		},
		agent,
		llmContext:
			'If the request was successful, the capture has been initiated. You can poll the dex_list_remote_commands tool periodically to check on the completion status.',
		callback: async ({ accountId, accessToken, device_id, user_email, ...command_args }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						commands: [
							{
								type: 'pcap',
								device_id,
								user_email,
								args: command_args,
								version: 1,
							},
						],
					}),
				},
			})
		},
	})

	registerTool({
		name: 'dex_create_remote_warp_diag',
		description:
			'Create a remote Warp Diagnostic (WARP-diag) for a specific device to collect network and connectivity troubleshooting data. Use when the user wants to diagnose connectivity issues, performance problems, or network configuration errors on a remote device running Cloudflare WARP. Accepts `device_id` (required) and `diagnostic_type` (optional). e.g., device_id="abc123-def456", diagnostic_type="full" or "network-only". This is a resource-intensive and privacy-sensitive operation that may impact device performance during execution. Raises an error if the device is offline or lacks diagnostic permissions. Do not use when you need to list available devices (use a device listing tool instead).' +
			'Always ask for confirmation from the user that the targeted email and device are correct before executing a capture',
		schema: {
			device_id: z.string().uuid().describe('The device ID to target.'),
			user_email: z.string().email().describe('The email of the user associated with the device.'),
			'test-all-routes': z
				.boolean()
				.default(true)
				.describe(
					'Test an IP address from all included or excluded ranges. Tests an IP address from all included or excluded ranges.' +
						"Essentially the same as running 'route get '' and collecting the results. This option may increase the time taken to collect the warp-diag"
				),
		},
		agent,
		llmContext:
			'If the request was successful, the diagnostic has been initiated. You can poll the dex_list_remote_commands tool periodically to check on the completion status.' +
			'See https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/troubleshooting/warp-logs/ for more info on warp-diags',
		callback: async ({ accountId, accessToken, device_id, user_email, ...command_args }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						commands: [
							{
								type: 'warp-diag',
								device_id,
								user_email,
								args: command_args,
								version: 1,
							},
						],
					}),
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_remote_captures',
		description:
			'List remote captures available for device debugging and network analysis. Use when the user wants to retrieve debugging data like packet captures (PCAPs) or WARP diagnostic files from Cloudflare. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts optional filtering parameters such as `device_id` and `capture_type`. e.g., capture_type="pcap" or device_id="warp-client-123". Raises an error if the account lacks debugging permissions or if no captures are available.'s edge network. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts optional filtering parameters such as `device_id`, `capture_type`, and `time_range`. Returns capture metadata including file names, sizes, and timestamps, e.g., "pcap-2024-01-15-device123.pcap" or "warp-diag-mobile-app.json". Raises an error if the account lacks debugging permissions or no captures are available for the specified criteria.',
		schema: { page: pageParam },
		agent,
		callback: async ({ accountId, accessToken, page }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands?${new URLSearchParams({ page: String(page), per_page: `50` })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_fleet_status_live',
		description:
			'Retrieve real-time status details of the Cloudflare device fleet broken down by operational dimensions. Use when the user wants to monitor current fleet health, analyze device distribution, or troubleshoot connectivity issues across regions. Accepts dimension filters such as `mode`, `status`, `colo`, `platform`, and `version` parameters. e.g., filtering by status="online" or platform="linux" to view specific device segments. Returns error if API credentials lack fleet monitoring permissions. Do not use when you need historical fleet data or performance metrics (use appropriate monitoring tools instead).',
		schema: {
			since_minutes: z
				.number()
				.min(1)
				.max(60)
				.default(10)
				.describe(
					'Number of minutes before current time to use as cutoff for device states to include.'
				),
			colo: coloParam.optional(),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/fleet-status/live?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_fleet_status_over_time',
		description:
			'Retrieve aggregate time series data showing device fleet status or performance metrics for specific devices over a specified time period. Use when the user wants to analyze historical trends, monitor device health patterns, or generate performance reports across time ranges. Accepts `time_period` (required), `device_id` (optional for specific device metrics), and `metric_type` (optional filter). e.g., time_period="last_7_days" or device_id="device-abc123". Do not use when you need real-time current status (use a live monitoring tool instead). Raises an error if the specified time period exceeds data retention limits.',
		schema: {
			from: timeStartParam,
			to: timeEndParam,
			interval: aggregationIntervalParam,
			colo: coloParam
				.optional()
				.describe('Filter results to WARP devices connected to a specific colo.'),
			device_id: z.string().uuid().optional().describe('Filter results to a specific device.'),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/fleet-status/over-time?${new URLSearchParams({ ...(params as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_fleet_status_logs',
		description:
			'Retrieve raw fleet status device logs with configurable granularity and filtering options. Use when the user wants to monitor device connectivity, troubleshoot fleet issues, or analyze historical device status patterns. Accepts `source` (e.g., "last_seen" for connectivity logs), `level` (optional log verbosity), and filtering parameters. e.g., source="last_seen" to view the last known device states or source="heartbeat" for periodic status updates. Returns an error if the fleet ID is invalid or access permissions are insufficient. Do not use when you need general Cloudflare account information (use accounts_list instead). ' +
			'state per device within the specified time period. Use `source=hourly` to view logs showing an hourly rollup per device where values are the average value of all' +
			'events within the time period. Use `source=raw` to view all logs for the specified period.',
		schema: {
			page: pageParam,
			from: timeStartParam,
			to: timeEndParam,
			source: z
				.enum(['last_seen', 'hourly', 'raw'])
				.describe('Specifies the granularity of results.'),
			colo: coloParam.optional(),
			device_id: z.string().uuid().optional().describe('Filter results to a specific device.'),
			mode: z.string().optional().describe('Filter results to devices with a specific WARP mode.'),
			platform: z
				.string()
				.optional()
				.describe('Filter results to devices on a specific operating system.'),
			status: z
				.string()
				.optional()
				.describe('Filter results to devices with a specific WARP connection status.'),
			version: z
				.string()
				.optional()
				.describe('Filter results to devices with a specific WARP client version.'),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/fleet-status/devices?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}&per_page=50`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_warp_change_events',
		description: 'List WARP configuration change events and toggle logs from Cloudflare for Zero Trust. Use when the user wants to audit WARP client activity, troubleshoot connectivity issues, or review security policy changes. Accepts `account_id` (required), `start_date` and `end_date` (optional ISO timestamps), and `user_id` (optional filter). e.g., start_date="2024-01-01T00:00:00Z", end_date="2024-01-31T23:59:59Z". Returns error if the account lacks Zero Trust subscription or invalid date range provided. Do not use when you need general Cloudflare account information (use accounts_list instead).',
		schema: {
			from: timeStartParam,
			to: timeEndParam,
			page: pageParam,
			account_name: z.string().optional().describe('Optionally filter events by account name.'),
			config_name: z
				.string()
				.optional()
				.describe(
					'Optionally filter events by WARP configuration name changed from or to. Applicable to `type=config` events only.'
				),
			sort_order: z
				.enum(['ASC', 'DESC'])
				.optional()
				.default('ASC')
				.describe('Set timestamp sort order.'),
			toggle: z
				.enum(['on', 'off'])
				.optional()
				.describe(
					'Optionally filter events by toggle value. Applicable to `type=toggle` events only.'
				),
			type: z.enum(['config', 'toggle']).optional().describe('Optionally filter events by type.'),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/warp-change-events?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}&per_page=50`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_colos',
		description:
			'List Cloudflare colos (data centers) sorted alphabetically or by frequency from fleet status and DEX test data. Use when the user wants to view available Cloudflare edge locations for network analysis or troubleshooting connectivity issues. Accepts `sort` parameter (optional: "alphabetical" or "frequency"). e.g., sort="frequency" to see most commonly encountered colos first. Returns an error if DEX data is unavailable or the account lacks proper permissions. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead).',
		schema: {
			from: timeStartParam,
			to: timeEndParam,
			sortBy: z
				.enum(['fleet-status-usage', 'application-tests-usage'])
				.optional()
				.describe(
					'Use `fleet-status-usage` to sort by frequency seen in device state checkins.' +
						'Use `application-tests-usage` to sort by frequency seen in DEX test results. Omit to sort alphabetically.'
				),
		},
		agent,
		callback: async ({ accountId, accessToken, ...params }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/colos?${new URLSearchParams({ ...(params as unknown as Record<string, string>) })}`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})

	registerTool({
		name: 'dex_list_remote_warp_diag_contents',
		description:
			'List the files contained within a WARP diagnostic archive from a remote capture. Use when the user wants to inspect or review the contents of a specific WARP diagnostic capture before extracting or analyzing individual files. Accepts `remote_capture_id` (required) and `device_id` (required) to identify the specific diagnostic archive. e.g., remote_capture_id="abc123def456", device_id="device-789xyz". Returns an error if the capture ID does not exist or the device ID is invalid. Do not use when you need to download or extract the actual file contents (use a file extraction tool instead).',
		schema: {
			deviceId: deviceIdParam.describe(
				'The device_id field of the successful WARP-diag remote capture response to list contents of.'
			),
			commandId: z
				.string()
				.uuid()
				.describe(
					'The id of the successful WARP-diag remote capture response to list contents of.'
				),
		},
		llmContext:
			'Use the dex_explore_remote_warp_diag_output tool for specific file paths to explore the file contents for analysis. ' +
			'Hint: you can call dex_explore_remote_warp_diag_output multiple times in parallel if necessary to take advantage of in-memory caching for best performance.' +
			'See https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/troubleshooting/warp-logs/ for more info on warp-diags',
		agent,
		callback: async ({ accessToken, deviceId, commandId }) => {
			const reader = await getReader({ accessToken, deviceId, commandId })
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return new Error(`Failed to get active account id`)
			}

			return await reader.list({ accessToken, accountId, commandId, deviceId })
		},
	})

	registerTool({
		name: 'dex_explore_remote_warp_diag_output',
		description:
			'Retrieve and analyze the contents of remote WARP diagnostic archive files using filepaths returned by dex_list_remote_warp_diag_contents. Use when the user wants to examine specific diagnostic files, logs, or configuration data within a WARP capture archive for troubleshooting network issues. Accepts `filepath` (required string) specifying the exact path within the diagnostic archive, e.g., "logs/warp-client.log" or "config/settings.json". Do not use when you need to first discover available files in the archive (use dex_list_remote_warp_diag_contents instead). Raises an error if the specified filepath does not exist within the diagnostic archive or if the archive is corrupted.',
		schema: {
			commandId: z.string().uuid().describe('The id of the command results to explore'),
			deviceId: deviceIdParam.describe('The device_id field of command to explore'),
			filepath: z.string().describe('The file path from the archive to retrieve contents for.'),
		},
		llmContext:
			'To avoid hitting conversation and memory limits, avoid outputting the whole contents of these files to the user unless specifically asked to. Instead prefer to show relevant snippets only.',
		agent,
		callback: async ({ accessToken, deviceId, commandId, filepath }) => {
			const reader = await getReader({ accessToken, deviceId, commandId })
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return new Error(`Failed to get active account id`)
			}

			return await reader.read({ accessToken, accountId, deviceId, commandId, filepath })
		},
	})

	registerTool({
		name: 'dex_analyze_warp_diag',
		description:
			'Analyze successful WARP-diag remote captures to identify common device-level connectivity issues. Use when the user wants to troubleshoot WARP client problems, diagnose network connectivity failures, or investigate device-specific configuration issues. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `capture_data` (required diagnostic file) and `analysis_type` (optional: "connectivity", "dns", or "performance"). e.g., analyzing a .warp-diag file for DNS resolution problems or tunnel connectivity issues. Raises an error if the capture file is corrupted or incomplete.',
		schema: {
			command_id: z
				.string()
				.uuid()
				.describe('The command_id of the successful WARP-diag remote capture to analyze.'),
		},
		llmContext:
			'Detections with 0 occurences can be ruled out. Focus on detections with the highest severity.',
		agent,
		callback: async ({ accessToken, accountId, command_id }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands/${command_id}/analysis`,
				accountId,
				apiToken: accessToken,
				options: {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})
		},
	})
}

// Helper to simplify tool registration by reducing boilerplate for accountId and accessToken
const registerTool = <T extends ZodRawShape, U = unknown>({
	name,
	description,
	agent,
	callback,
	schema = {},
	llmContext = '',
}: {
	name: string
	description: string
	schema?: T | ToolAnnotations
	llmContext?: string
	agent: CloudflareDEXMCP
	callback: (
		p: { extra: unknown; accountId: string; accessToken: string } & z.objectOutputType<
			T,
			ZodTypeAny
		>
	) => Promise<U>
}) => {
	agent.server.tool<T>(name, description, schema, (async (params, extra) => {
		const accountId = await agent.getActiveAccountId()
		if (!accountId) {
			return {
				content: [
					{
						type: 'text',
						text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
					},
				],
			}
		}

		try {
			const props = getProps(agent)
			const accessToken = props.accessToken
			const res = await callback({ ...(params as T), extra, accountId, accessToken })
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							data: res,
							llmContext,
						}),
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: `Error with tool ${name}: ${error instanceof Error && error.message}`,
						}),
					},
				],
			}
		}
	}) as ToolCallback<T>)
}

// Shared parameter schemas
const timeStartParam = z
	.string()
	.describe(
		'The datetime of the beginning point of time range for results. Must be in ISO 8601 datetime string in the extended format with UTC time (e.g, 2025-04-21T18:00:00Z).'
	)
const timeEndParam = z
	.string()
	.describe(
		'The datetime of the ending point of time range for results. Must be in ISO 8601 datetime string in the extended format with UTC time (e.g, 2025-04-22T00:00:00Z).'
	)
const aggregationIntervalParam = z
	.enum(['minute', 'hour'])
	.describe('The time interval to group results by.')

const pageParam = z.number().min(1).describe('The page of results to retrieve.')
const coloParam = z
	.string()
	.regex(/^[A-Z]{3}$/, '3-letter colo codes only')
	.describe('Optionally filter results to a specific Cloudflare colo.')
const deviceIdParam = z.string().uuid()
const testIdParam = z.string().uuid()
