import { z } from 'zod'

export type BuildDetails = z.infer<typeof BuildDetails>
export const BuildDetails = z.object({
	// TODO: Maybe remove fields we don't need to reduce surface area of things we need to update
	build_uuid: z.string(),
	status: z.string(),
	build_outcome: z.string().nullable(),
	created_on: z.coerce.date(),
	modified_on: z.coerce.date(),
	initializing_on: z.coerce.date().nullable(),
	running_on: z.coerce.date().nullable(),
	stopped_on: z.coerce.date().nullable(),
	trigger: z.object({
		trigger_uuid: z.string(),
		external_script_id: z.string(),
		trigger_name: z.string(),
		build_command: z.string(),
		deploy_command: z.string(),
		root_directory: z.string(),
		branch_includes: z.array(z.string()),
		branch_excludes: z.array(z.string()),
		path_includes: z.array(z.string()),
		path_excludes: z.array(z.string()),
		build_caching_enabled: z.boolean(),
		created_on: z.coerce.date(),
		modified_on: z.coerce.date(),
		deleted_on: z.coerce.date().nullable(),
		repo_connection: z.object({
			repo_connection_uuid: z.string(),
			repo_id: z.string(),
			repo_name: z.string(),
			provider_type: z.string(),
			provider_account_id: z.string(),
			provider_account_name: z.string(),
			created_on: z.coerce.date(),
			modified_on: z.coerce.date(),
			deleted_on: z.coerce.date().nullable(),
		}),
	}),
	build_trigger_metadata: z.object({
		build_trigger_source: z.string(),
		branch: z.string(),
		commit_hash: z.string(),
		commit_message: z.string(),
		author: z.string(),
		build_command: z.string(),
		deploy_command: z.string(),
		root_directory: z.string(),
		build_token_uuid: z.string(),
		environment_variables: z.record(
			z.string(),
			z.object({
				is_secret: z.boolean(),
				created_on: z.coerce.date(),
				value: z.string().nullable(),
			})
		),
		repo_name: z.string(),
		provider_account_name: z.string(),
		provider_type: z.string(),
	}),
	pull_request: z.unknown(),
})

/**
 * GET /builds/workers/:external_script_id/builds
 */
export type ListBuildsByScriptResult = z.infer<typeof ListBuildsByScriptResult>
export const ListBuildsByScriptResult = z.array(BuildDetails)

export type ListBuildsByScriptResultInfo = z.infer<typeof ListBuildsByScriptResultInfo>
export const ListBuildsByScriptResultInfo = z.object({
	next_page: z.boolean(),
	page: z.number(),
	per_page: z.number(),
	count: z.number(),
	total_count: z.number(),
	total_pages: z.number(),
})

export type GetBuildResult = z.infer<typeof GetBuildResult>
export const GetBuildResult = BuildDetails

export type LogLine = z.infer<typeof LogLine>
export const LogLine = z.tuple([
	z.coerce.date().describe('line timestamp'),
	z.string().describe('line message'),
])

export type GetBuildLogsResult = z.infer<typeof GetBuildLogsResult>
export const GetBuildLogsResult = z.object({
	cursor: z.string().optional().describe('pagination cursor'),
	truncated: z.boolean(),
	lines: z.array(LogLine),
})
