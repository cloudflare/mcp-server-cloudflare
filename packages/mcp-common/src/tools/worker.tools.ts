import { z } from 'zod'

import {
	handleGetWorkersService,
	handleWorkerScriptDownload,
	handleWorkersList,
} from '../api/workers.api'
import { getCloudflareClient } from '../cloudflare-api'
import { fmt } from '../format'
import { requireRequestProps } from '../request-context'

import type { McpRegistrationContext } from '../registration-context'

/**
 * Registers the workers tools with the MCP server
 * @param context The request-local registration context
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
// Define the scriptName parameter schema
const workerNameParam = z.string().describe('The name of the worker script to retrieve')

export function registerWorkersTools<Env>(context: McpRegistrationContext<Env>) {
	// Tool to list all workers
	context.accountTool(
		'workers_list',
		{
			description: fmt.trim(`
			List all Workers in your Cloudflare account.

			If you only need details of a single Worker, use workers_get_worker.
		`),
			inputSchema: z.object({}),
			annotations: {
				title: 'List Workers',
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async (_params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const results = await handleWorkersList({
					client: getCloudflareClient(props.accessToken),
					accountId,
				})
				// Extract worker details and sort by created_on date (newest first)
				const workers = results
					.map((worker) => ({
						name: worker.id,
						// The API client doesn't know tag exists. The tag is needed in other places such as Workers Builds
						id: z.object({ tag: z.string() }).parse(worker),
						modified_on: worker.modified_on || null,
						created_on: worker.created_on || null,
					}))
					// order by created_on desc ( newest first )
					.sort((a, b) => {
						if (!a.created_on) return 1
						if (!b.created_on) return -1
						return new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
					})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								workers,
								count: workers.length,
							}),
						},
					],
				}
			} catch (e) {
				context.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error listing workers: ${e instanceof Error && e.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	// Tool to get a specific worker's script details
	context.accountTool(
		'workers_get_worker',
		{
			description: 'Get the details of the Cloudflare Worker.',
			inputSchema: z.object({
				scriptName: workerNameParam,
			}),
			annotations: {
				title: 'Get Worker details',
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const { scriptName } = params
				const res = await handleGetWorkersService({
					apiToken: props.accessToken,
					scriptName,
					accountId,
				})

				if (!res.result) {
					return {
						content: [
							{
								type: 'text',
								text: 'Worker not found',
							},
						],
					}
				}

				return {
					content: [
						{
							type: 'text',
							text: await fmt.asTSV([
								{
									name: res.result.id,
									id: res.result.default_environment.script_tag,
								},
							]),
						},
					],
				}
			} catch (e) {
				context.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error retrieving worker script: ${e instanceof Error && e.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	// Tool to get a specific worker's script content
	context.accountTool(
		'workers_get_worker_code',
		{
			description:
				'Get the source code of a Cloudflare Worker. Note: This may be a bundled version of the worker.',
			inputSchema: z.object({ scriptName: workerNameParam }),
			annotations: {
				title: 'Get Worker code',
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const { scriptName } = params
				const scriptContent = await handleWorkerScriptDownload({
					client: getCloudflareClient(props.accessToken),
					scriptName,
					accountId,
				})
				return {
					content: [
						{
							type: 'text',
							text: scriptContent,
						},
					],
				}
			} catch (e) {
				context.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error retrieving worker script: ${e instanceof Error && e.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
