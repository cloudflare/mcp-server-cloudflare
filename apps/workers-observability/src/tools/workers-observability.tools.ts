import { writeToString } from '@fast-csv/format'

import {
	handleWorkerLogsKeys,
	handleWorkerLogsValues,
	queryWorkersObservability,
} from '@repo/mcp-common/src/api/workers-observability.api'
import {
	zKeysRequest,
	zQueryRunRequest,
	zValuesRequest,
} from '@repo/mcp-common/src/types/workers-logs.types'

import type { ObservabilityMCP } from '../workers-observability.app'

/**
 * Registers the logs analysis tool with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerObservabilityTools(agent: ObservabilityMCP) {
	// Register the worker logs analysis tool by worker name
	agent.server.tool(
		'query_worker_observability',
		`Query the Workers Observability API to analyze logs and metrics from your Cloudflare Workers.

	* A query typical query looks like this:
				{"view":"events","queryId":"workers-logs-events","limit":5,"dry":true,"parameters":{"datasets":["cloudflare-workers"],"filters":[{"id":"520","key":"message","operation":"eq","type":"string","value":"Clickhouse Statistics"},{"id":"2088","key":"statistics.elapsed","operation":"gt","type":"number","value":"0.269481519"}],"calculations":[],"groupBys":[],"havings":[]},"timeframe":{"to":"2025-04-30T20:53:15Z","from":" ""2025-04-30T19:53:15Z"}}
## Core Capabilities
This tool provides three primary views of your Worker data:
1. **List Events** - Browse individual request logs and errors
2. **Calculate Metrics** - Compute statistics across requests (avg, p99, etc.)
3. **Find Specific Invocations** - Locate individual requests matching criteria

## Filtering Best Practices
- Before applying filters, use the observability_keys and observability_values tools to confirm available filter fields and the correct filter value to add unless you have the data in a response from a previous query.
- Common filter fields:  $metadata.service, $metadata.trigger, $metadata.message, $metadata.level, $metadata.requestId,

## Calculation Best Practices
- Before applying calculations, use the observability_keys tools to confirm key that should be used for the calculation

## Troubleshooting
- If no results are returned, suggest broadening the time range or relaxing filters
- For errors about invalid fields, recommend using observability_keys to see available options
`,

		{
			query: zQueryRunRequest,
		},
		async ({ query }) => {
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
				const response = await queryWorkersObservability(agent.props.accessToken, accountId, query)

				if (query.view === 'calculations') {
					let data = ''
					for (const calculation of response?.calculations || []) {
						const alias = calculation.alias || calculation.calculation
						const aggregates = calculation.aggregates.map((agg) => {
							const keys = agg.groups?.reduce(
								(acc, group) => {
									acc[`${group.key}`] = `${group.value}`
									return acc
								},
								{} as Record<string, string>
							)
							return {
								...keys,
								[alias]: agg.value,
							}
						})

						const aggregatesString = await writeToString(aggregates, {
							headers: true,
							delimiter: '\t',
						})

						const series = calculation.series.map(({ time, data }) => {
							return {
								time,
								...data.reduce(
									(acc, point) => {
										const key = point.groups?.reduce((acc, group) => {
											return `${acc} * ${group.value}`
										}, '')
										if (!key) {
											return {
												...acc,
												[alias]: point.value,
											}
										}
										return {
											...acc,
											key,
											[alias]: point.value,
										}
									},
									{} as Record<string, string | number | undefined>
								),
							}
						})
						const seriesString = await writeToString(series, { headers: true, delimiter: '\t' })
						data = data + '\n' + `## ${alias}`
						data = data + '\n' + `### Aggregation`
						data = data + '\n' + aggregatesString
						data = data + '\n' + `### Series`
						data = data + '\n' + seriesString
					}

					return {
						content: [
							{
								type: 'text',
								text: data,
							},
						],
					}
				}

				if (query.view === 'events') {
					const events = response?.events?.events
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(events),
							},
						],
					}
				}

				if (query.view === 'invocations') {
					const invocations = Object.entries(response?.invocations || {}).map(([_, logs]) => {
						const invocationLog = logs.find((log) => log.$metadata.type === 'cf-worker-event')
						return invocationLog?.$metadata ?? logs[0]?.$metadata
					})

					const tsv = await writeToString(invocations, { headers: true, delimiter: '\t' })
					return {
						content: [
							{
								type: 'text',
								text: tsv,
							},
						],
					}
				}
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error analyzing worker logs: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'observability_keys',
		`Find keys in the Workers Observability Data

## Best Practices
- Set a high limit (1000+) to ensure you see all available keys
- Add the $metadata.service filter to narrow results to a specific Worker

## Troubleshooting
- If expected fields are missing, verify the Worker is actively logging
- For empty results, try broadening your time range
`,
		{ keysQuery: zKeysRequest },
		async ({ keysQuery }) => {
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
				const result = await handleWorkerLogsKeys(agent.props.accessToken, accountId, keysQuery)

				const tsv = await writeToString(
					result.map((key) => ({ type: key.type, key: key.key })),
					{ headers: true, delimiter: '\t' }
				)
				return {
					content: [
						{
							type: 'text',
							text: tsv,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error retrieving worker telemetry keys: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'observability_values',
		`Find values in the Workers Observability Data.

## Troubleshooting
- For no results, verify the field exists using observability_keys first
- If expected values are missing, try broadening your time range`,
		{ valuesQuery: zValuesRequest },
		async ({ valuesQuery }) => {
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
				const result = await handleWorkerLogsValues(agent.props.accessToken, accountId, valuesQuery)
				const tsv = await writeToString(
					result?.map((value) => ({ type: value.type, value: value.value })) || [],
					{ headers: true, delimiter: '\t' }
				)
				return {
					content: [
						{
							type: 'text',
							text: tsv,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error retrieving worker telemetry values: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)
}
