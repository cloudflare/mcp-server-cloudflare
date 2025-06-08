import { z } from 'zod'

import { getBuild, getBuildLogs, listBuilds } from '@repo/mcp-common/src/api/workers-builds.api'
import { fmt } from '@repo/mcp-common/src/format'

import type { BuildsMCP } from '../workers-builds.app'

/**
 * Registers the Workers Builds tools with the MCP server
 * @param server The MCP server instance
 * @param accountId Cloudflare account ID
 * @param apiToken Cloudflare API token
 */
export function registerBuildsTools(agent: BuildsMCP) {
	agent.server.tool(
		'workers_builds_set_active_worker',
		fmt.trim(`
			Set the active Worker ID for subsequent calls.
			Use this tool to set the active worker for subsequent calls.

			Worker IDs are formatted similar to: db6a6421c2b046679a9daada1537088b
			If you are given a Worker name or script name, you can use workers_get_worker to get the Worker ID.
		`),
		{
			workerId: z.string().describe('The Worker ID to set as active.'),
		},
		async ({ workerId }) => {
			await agent.setActiveWorkerId(workerId)
			return {
				content: [
					{
						type: 'text',
						text: `Active worker set to ${workerId}`,
					},
				],
			}
		}
	)

	agent.server.tool(
		'workers_builds_list_builds',
		fmt.trim(`
			Use the Workers Builds API to list builds for a Cloudflare Worker.

			MUST provide a workerId or call workers_builds_set_active_worker first.
		`),
		{
			workerId: z.string().optional().describe('The Worker ID to list builds for.'),
			page: z.number().optional().default(1).describe('The page number to return.'),
			perPage: z.number().optional().default(10).describe('The number of builds per page.'),
		},
		async ({ workerId, page, perPage }) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: fmt.oneLine(`
								No currently active accountId. Try listing your accounts (accounts_list)
								and then setting an active account (set_active_account)
							`),
						},
					],
				}
			}

			if (!workerId) {
				const activeWorkerId = await agent.getActiveWorkerId()
				if (activeWorkerId) {
					workerId = activeWorkerId
				} else {
					return {
						content: [
							{
								type: 'text',
								text: fmt.oneLine(`
									No workerId provided and no active workerId.
									Either provide a workerId or call workers_builds_set_active_worker first.
								`),
							},
						],
					}
				}
			}

			try {
				const res = await listBuilds({
					apiToken: agent.props.accessToken,
					accountId,
					workerId,
					page,
					perPage,
				})

				if (!res.result) {
					return {
						content: [
							{
								type: 'text',
								text: 'No builds found',
							},
						],
					}
				}

				const buildsFormatted = res.result
					.sort((a, b) => b.created_on.getTime() - a.created_on.getTime())
					.map((build) => ({
						buildUUID: build.build_uuid,
						createdOn: build.created_on.toISOString(),
						status: build.status,
						buildOutcome: build.build_outcome,
						branch: build.build_trigger_metadata.branch,
						commitHash: build.build_trigger_metadata.commit_hash,
						commitMessage: build.build_trigger_metadata.commit_message,
						commitAuthor: build.build_trigger_metadata.author,
					}))

				return {
					content: [
						{
							type: 'text',
							text: 'pagination_info:',
						},
						{
							type: 'text',
							text: await fmt.asTSV([res.result_info]),
						},
						{
							type: 'text',
							text: 'builds:',
						},
						{
							type: 'text',
							text: await fmt.asTSV(buildsFormatted),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error: listing builds failed: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'workers_builds_get_build',
		fmt.trim(`
			Get details for a specific build by its UUID.
			Includes build and deploy commands for the build (useful for debugging build failures).
		`),
		{
			buildUUID: z.string().describe('The build UUID to get details for.'),
		},
		async ({ buildUUID }) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Set an active account first.',
						},
					],
				}
			}

			try {
				const { result: build } = await getBuild({
					apiToken: agent.props.accessToken,
					accountId,
					buildUUID,
				})

				if (!build) {
					return {
						content: [
							{
								type: 'text',
								text: 'Build not found',
							},
						],
					}
				}

				const buildFormatted = {
					buildUUID: build.build_uuid,
					createdOn: build.created_on.toISOString(),
					status: build.status,
					buildOutcome: build.build_outcome,
					branch: build.build_trigger_metadata.branch,
					commitHash: build.build_trigger_metadata.commit_hash,
					commitMessage: build.build_trigger_metadata.commit_message,
					commitAuthor: build.build_trigger_metadata.author,
					buildCommand: build.build_trigger_metadata.build_command,
					deployCommand: build.build_trigger_metadata.deploy_command,
				}

				return {
					content: [
						{
							type: 'text',
							text: await fmt.asTSV([buildFormatted]),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error: getting build failed: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'workers_builds_get_build_logs',
		fmt.trim(`
			Get logs for a Cloudflare Workers build.
		`),
		{
			buildUUID: z.string().describe('The build UUID to get logs for.'),
		},
		async ({ buildUUID }) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Set an active account first.',
						},
					],
				}
			}

			try {
				const logs = await getBuildLogs({
					apiToken: agent.props.accessToken,
					accountId,
					buildUUID,
				})
				const logsFormatted = logs.map((log) => ({
					timestamp: `${log[0].getUTCHours()}:${log[0].getUTCMinutes()}:${log[0].getUTCSeconds()}`,
					message: log[1],
				}))
				return {
					content: [
						{
							type: 'text',
							text: await fmt.asTSV(logsFormatted),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error: getting build logs failed: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
