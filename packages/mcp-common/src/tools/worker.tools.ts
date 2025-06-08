import { z } from 'zod'

import {
	handleGetWorkersService,
	handleWorkerScriptDownload,
	handleWorkersList,
} from '../api/workers.api'
import { getCloudflareClient } from '../cloudflare-api'
import { fmt } from '../format'

import type { CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

/**
 * Registers the workers tools with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
// Define the scriptName parameter schema
const workerNameParam = z.string().describe('The name of the worker script to retrieve')

export function registerWorkersTools(agent: CloudflareMcpAgent) {
	// Tool to list all workers
	agent.server.tool(
		'workers_list',
		fmt.trim(`
			List all Workers in your Cloudflare account.

			If you only need details of a single Worker, use workers_get_worker.
		`),
		async () => {
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
				const results = await handleWorkersList({
					client: getCloudflareClient(agent.props.accessToken),
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
				agent.server.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error listing workers: ${e instanceof Error && e.message}`,
						},
					],
				}
			}
		}
	)

	// Tool to get a specific worker's script details
	agent.server.tool(
		'workers_get_worker',
		'Get the details of the Cloudflare Worker.',
		{
			scriptName: workerNameParam,
		},
		async (params) => {
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
				const { scriptName } = params
				const res = await handleGetWorkersService({
					apiToken: agent.props.accessToken,
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
				agent.server.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error retrieving worker script: ${e instanceof Error && e.message}`,
						},
					],
				}
			}
		}
	)

	// Tool to get a specific worker's script content
	agent.server.tool(
		'workers_get_worker_code',
		'Get the source code of a Cloudflare Worker. Note: This may be a bundled version of the worker.',
		{ scriptName: workerNameParam },
		async (params) => {
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
				const { scriptName } = params
				const scriptContent = await handleWorkerScriptDownload({
					client: getCloudflareClient(agent.props.accessToken),
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
				agent.server.recordError(e)
				return {
					content: [
						{
							type: 'text',
							text: `Error retrieving worker script: ${e instanceof Error && e.message}`,
						},
					],
				}
			}
		}
	)
}
