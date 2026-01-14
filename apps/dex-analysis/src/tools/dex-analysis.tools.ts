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
		description: 'Analyze Cloudflare DEX Test Results by quartile given a Test ID',
		schema: {
			testId: z.string().describe('The DEX Test ID to analyze details of.'),
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
		description: 'Retrieve a list of all Cloudflare DEX Tests configured.',
		agent,
		schema: { page: pageParam },
		callback: async ({ accountId, accessToken, page }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/tests/overview?page=${page}&per_page=50`,
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
		description: 'Retrieve detailed time series results for an HTTP DEX test by id.',
		schema: {
			testId: z.string().describe('The HTTP DEX Test ID to get details for.'),
			deviceId: z
				.string()
				.optional()
				.describe(
					"Optionally limit results to specific device(s). Can't be used in conjunction with the colo parameter."
				),
			colo: z
				.string()
				.optional()
				.describe('Optionally limit results to a specific Cloudflare colo.'),
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
		description: 'Retrieve detailed time series results for a Traceroute DEX test by id.',
		schema: {
			testId: z.string().describe('The traceroute DEX Test ID to get details for.'),
			deviceId: z
				.string()
				.optional()
				.describe(
					"Optionally limit results to specific device(s). Can't be used in conjunction with the colo parameter."
				),
			colo: z
				.string()
				.optional()
				.describe('Optionally limit results to a specific Cloudflare colo.'),
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
			'Retrieve aggregate network path data for a Traceroute DEX test by id. Use the dex_traceroute_test_result_network_path tool to further explore individual test runs hop-by-hop.',
		schema: {
			testId: z.string().describe('The traceroute DEX Test ID to get network path details for.'),
			deviceId: z.string().describe('The ID of the device to get network path details for.'),
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
			'Retrieve the hop-by-hop network path for a specific Traceroute DEX test result by id.',
		schema: {
			testResultId: z
				.string()
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
			"Retrieve a list of devices eligible for remote captures. You'll need the device_id and user_email from this " +
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
			'Create a remote packet capture (PCAP) for a device. This is a resource intensive and privacy-sensitive operation on a real user device.' +
			'Always ask for confirmation from the user that the targeted email and device are correct before executing a capture',
		schema: {
			device_id: z.string().describe('The device ID to target.'),
			user_email: z.string().describe('The email of the user associated with the device.'),
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
			'Create a remote Warp Diagnostic (WARP-diag) for a device. This is a resource intensive and privacy-sensitive operation on a real user device.' +
			'Always ask for confirmation from the user that the targeted email and device are correct before executing a capture',
		schema: {
			device_id: z.string().describe('The device ID to target.'),
			user_email: z.string().describe('The email of the user associated with the device.'),
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
			'Retrieve a list of remote captures for device debugging, like PCAPs or WARP Diags.',
		schema: { page: pageParam },
		agent,
		callback: async ({ accountId, accessToken, page }) => {
			return await fetchCloudflareApi({
				endpoint: `/dex/commands?page=${page}&per_page=50`,
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
			'Retrieve details about the real-time status of the fleet of devices broken down by dimension (mode, status, colo, platform, version)',
		schema: {
			since_minutes: z
				.number()
				.min(1)
				.max(60)
				.default(10)
				.describe(
					'Number of minutes before current time to use as cutoff for device states to include.'
				),
			colo: z
				.string()
				.optional()
				.describe('Optionally filter results to a specific Cloudflare colo.'),
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
			'Retrieve aggregate time series details about the status of the fleet of devices, or performance metrics for a specific device, over the specified time period.',
		schema: {
			from: timeStartParam,
			to: timeEndParam,
			interval: aggregationIntervalParam,
			colo: z
				.string()
				.optional()
				.describe('Filter results to WARP devices connected to a specific colo.'),
			device_id: z.string().optional().describe('Filter results to a specific device.'),
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
			'Retrieve raw fleet status device logs with a variety of levels of granularity and filtering. Use `source=last_seen` to view logs showing the last known ' +
			'state per device within the specified time period. Use `source=hourly` to view logs showing an hourly rollup per device where values are the average value of all' +
			'events within the time period. Use `source=raw` to view all logs for the specified period.',
		schema: {
			page: pageParam,
			from: timeStartParam,
			to: timeEndParam,
			source: z
				.enum(['last_seen', 'hourly', 'raw'])
				.describe('Specifies the granularity of results.'),
			colo: z
				.string()
				.optional()
				.describe('Filter results to WARP devices connected to a specific colo.'),
			device_id: z.string().optional().describe('Filter results to a specific device.'),
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
		description: 'View logs of events when users toggle WARP on or off, or change configurations.',
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
			'View a list of Cloudflare colos sorted alphabetically or by frequency encountered in fleet status or DEX test data.',
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
			'Given a WARP diag remote capture id and device_id, returns a list of the files contained in the archive.',
		schema: {
			deviceId: z
				.string()
				.describe(
					'The device_id field of the successful WARP-diag remote capture response to list contents of.'
				),
			commandId: z
				.string()
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
			'Explore the contents of remote capture WARP diag archive filepaths returned by the dex_list_remote_warp_diag_contents tool for analysis.',
		schema: {
			commandId: z.string().describe('The id of the command results to explore'),
			deviceId: z.string().describe('The device_id field of command to explore'),
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
			'Analyze successful WARP-diag remote captures for common issues. This should be the first place you start when trying to narrow down device-level issues with WARP.',
		schema: {
			command_id: z
				.string()
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
