import { z } from 'zod'

import { getBuild, getBuildLogs, listBuilds } from '@repo/mcp-common/src/api/workers-builds.api'
import { fmt } from '@repo/mcp-common/src/format'
import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'
import type { Env } from '../workers-builds.context'

/** Registers stateless Workers Builds tools. Every target is explicit in the call. */
export function registerBuildsTools(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'workers_builds_list_builds',
		{
			description: fmt.trim(`
				Use the Workers Builds API to list builds for a Cloudflare Worker.

				workerId is required. Use workers_list to find a Worker's ID when needed.
			`),
			inputSchema: z.object({
				workerId: z.string().min(1).describe('The Worker ID to list builds for.'),
				page: z.number().optional().default(1).describe('The page number to return.'),
				perPage: z.number().optional().default(10).describe('The number of builds per page.'),
			}),
			annotations: { title: 'List Worker builds', readOnlyHint: true },
		},
		async ({ workerId, page, perPage }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const res = await listBuilds({
					apiToken: props.accessToken,
					accountId,
					workerId,
					page,
					perPage,
				})

				if (!res.result) {
					return { content: [{ type: 'text', text: 'No builds found' }] }
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
						{ type: 'text', text: 'pagination_info:' },
						{ type: 'text', text: await fmt.asTSV([res.result_info]) },
						{ type: 'text', text: 'builds:' },
						{ type: 'text', text: await fmt.asTSV(buildsFormatted) },
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
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'workers_builds_get_build',
		{
			description: fmt.trim(`
				Get details for a specific build by its UUID.
				Includes build and deploy commands for the build (useful for debugging build failures).
			`),
			inputSchema: z.object({
				buildUUID: z.string().min(1).describe('The build UUID to get details for.'),
			}),
			annotations: { title: 'Get Worker build', readOnlyHint: true },
		},
		async ({ buildUUID }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const { result: build } = await getBuild({
					apiToken: props.accessToken,
					accountId,
					buildUUID,
				})

				if (!build) {
					return { content: [{ type: 'text', text: 'Build not found' }] }
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

				return { content: [{ type: 'text', text: await fmt.asTSV([buildFormatted]) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error: getting build failed: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'workers_builds_get_build_logs',
		{
			description: 'Get logs for a Cloudflare Workers build by its explicit UUID.',
			inputSchema: z.object({
				buildUUID: z.string().min(1).describe('The build UUID to get logs for.'),
			}),
			annotations: { title: 'Get Worker build logs', readOnlyHint: true },
		},
		async ({ buildUUID }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const logs = await getBuildLogs({
					apiToken: props.accessToken,
					accountId,
					buildUUID,
				})
				const logsFormatted = logs.map((log) => ({
					timestamp: `${log[0].getUTCHours()}:${log[0].getUTCMinutes()}:${log[0].getUTCSeconds()}`,
					message: log[1],
				}))
				return { content: [{ type: 'text', text: await fmt.asTSV(logsFormatted) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error: getting build logs failed: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
