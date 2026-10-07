import { z } from 'zod'

import { fmt } from '@repo/mcp-common/src/format'
import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import {
	createWorkerDeployment,
	deleteWorkerDeployment,
	deleteWorkerScript,
	downloadWorkerScript,
	getWorkerDeployment,
	listWorkerDeployments,
	listWorkerScripts,
	listWorkerVersions,
	uploadWorkerScript,
	uploadWorkerVersion,
} from '../api/workers-scripts.api'

import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'
import type { Env } from '../workers-scripts.context'

const scriptName = z.string().min(1).max(256).describe('The exact Worker script name.')
const deploymentId = z.string().uuid().describe('The deployment UUID.')
const versionId = z.string().uuid().describe('The Worker version UUID.')
const pageSchema = z.number().int().min(1).default(1)
const perPageSchema = z.number().int().min(1).max(100).default(10)
const uploadInputs = {
	script: z
		.string()
		.min(1)
		.max(500_000)
		.describe(
			'The complete single-file ES module source for worker.js (maximum 500,000 characters).'
		),
	compatibilityDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.describe('Workers compatibility date in YYYY-MM-DD format.'),
	compatibilityFlags: z
		.array(z.string())
		.optional()
		.describe('Workers compatibility flags; existing flags are retained when omitted on update.'),
	message: z.string().max(1000).optional().describe('Optional version or deployment note.'),
}

/** Registers explicit, account-scoped Workers script, version, and deployment tools. */
export function registerWorkersScriptsTools(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'workers_scripts_list',
		{
			description: 'List Worker scripts in the selected Cloudflare account.',
			inputSchema: z.object({}),
			annotations: { title: 'List Worker scripts', readOnlyHint: true },
		},
		async (_, accountId) => {
			try {
				const props = requireRequestProps(context)
				const scripts = await listWorkerScripts({
					apiToken: props.accessToken,
					accountId,
				})
				if (scripts === null) throw new Error('Cloudflare returned no Worker script list')
				return jsonResult(scripts)
			} catch (error) {
				return apiError('listing Worker scripts', error)
			}
		}
	)

	context.accountTool(
		'workers_scripts_download',
		{
			description: 'Download the raw source and multipart content for one Worker script.',
			inputSchema: z.object({ scriptName }),
			annotations: { title: 'Download Worker script', readOnlyHint: true },
		},
		async ({ scriptName: name }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const result = await downloadWorkerScript({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
				})
				return jsonResult(result)
			} catch (error) {
				return apiError('downloading Worker script', error)
			}
		}
	)

	context.accountTool(
		'workers_scripts_upload',
		{
			description: fmt.trim(`
				Create or replace a Worker with a single JavaScript module. This calls the immediate
				script upload API and publishes the uploaded code to traffic; use
				workers_versions_upload plus workers_deployments_create when you need a staged rollout.
				Existing named bindings are inherited; this tool cannot add or change bindings or
				upload additional modules or assets, or manage Durable Object migrations. Existing
				compatibility flags are retained when omitted.
			`),
			inputSchema: z.object({
				scriptName,
				...uploadInputs,
			}),
			annotations: {
				title: 'Create or immediately deploy Worker script',
				destructiveHint: true,
				openWorldHint: true,
			},
		},
		async ({ scriptName: name, ...input }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const result = await uploadWorkerScript({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					...input,
				})
				return jsonResult(result)
			} catch (error) {
				return apiError('uploading and deploying Worker script', error)
			}
		}
	)

	context.accountTool(
		'workers_versions_upload',
		{
			description: fmt.trim(`
				Upload a new Worker version without changing the version currently serving traffic.
				Use workers_deployments_create to deploy the returned version UUID.
				Existing named bindings are inherited; this accepts one JavaScript module and does
				not add or change bindings, upload extra modules or assets, or manage Durable Object
				migrations. Existing compatibility flags are retained when omitted.
			`),
			inputSchema: z.object({
				scriptName,
				...uploadInputs,
			}),
			annotations: {
				title: 'Upload Worker version',
				destructiveHint: false,
				openWorldHint: true,
			},
		},
		async ({ scriptName: name, ...input }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const result = await uploadWorkerVersion({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					...input,
				})
				return jsonResult(result)
			} catch (error) {
				return apiError('uploading Worker version', error)
			}
		}
	)

	context.accountTool(
		'workers_scripts_delete',
		{
			description: fmt.trim(`
				Permanently delete the named Worker script. Does not enable force deletion, which can
				break other Workers that depend on it. Deleting a Worker may also delete its
				Durable Object namespaces and stored data. Verify the exact script name before calling.
			`),
			inputSchema: z.object({ scriptName }),
			annotations: {
				title: 'Delete Worker script',
				destructiveHint: true,
				openWorldHint: true,
			},
		},
		async ({ scriptName: name }, accountId) => {
			try {
				const props = requireRequestProps(context)
				await deleteWorkerScript({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
				})
				return textResult(`Deleted Worker script "${name}".`)
			} catch (error) {
				return apiError('deleting Worker script', error)
			}
		}
	)

	context.accountTool(
		'workers_versions_list',
		{
			description:
				'List versions for an explicitly named Worker script; newest versions appear first.',
			inputSchema: z.object({
				scriptName,
				page: pageSchema,
				perPage: perPageSchema,
				deployable: z
					.boolean()
					.default(false)
					.describe('Only return versions that can be deployed.'),
			}),
			annotations: { title: 'List Worker versions', readOnlyHint: true },
		},
		async ({ scriptName: name, page, perPage, deployable }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const versions = await listWorkerVersions({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					page,
					perPage,
					deployable,
				})
				if (versions === null) throw new Error('Cloudflare returned no Worker version list')
				return jsonResult(versions)
			} catch (error) {
				return apiError('listing Worker versions', error)
			}
		}
	)

	context.accountTool(
		'workers_deployments_list',
		{
			description:
				'List deployments for an explicitly named Worker script; latest deployment is first.',
			inputSchema: z.object({ scriptName, page: pageSchema, perPage: perPageSchema }),
			annotations: { title: 'List Worker deployments', readOnlyHint: true },
		},
		async ({ scriptName: name, page, perPage }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const deployments = await listWorkerDeployments({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					page,
					perPage,
				})
				if (deployments === null) throw new Error('Cloudflare returned no Worker deployment list')
				return jsonResult(deployments)
			} catch (error) {
				return apiError('listing Worker deployments', error)
			}
		}
	)

	context.accountTool(
		'workers_deployments_get',
		{
			description: 'Get one deployment by its explicit Worker script name and deployment UUID.',
			inputSchema: z.object({ scriptName, deploymentId }),
			annotations: { title: 'Get Worker deployment', readOnlyHint: true },
		},
		async ({ scriptName: name, deploymentId: id }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const deployment = await getWorkerDeployment({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					deploymentId: id,
				})
				if (deployment === null) throw new Error('Cloudflare returned no Worker deployment')
				return jsonResult(deployment)
			} catch (error) {
				return apiError('getting Worker deployment', error)
			}
		}
	)

	context.accountTool(
		'workers_deployments_create',
		{
			description: fmt.trim(`
				Deploy explicit Worker version UUIDs to the requested traffic percentages. The
				percentages must sum to exactly 100. Use workers_versions_list to find deployable
				version UUIDs; creating a deployment changes live traffic.
			`),
			inputSchema: z.object({
				scriptName,
				versions: z
					.array(
						z.object({
							versionId,
							percentage: z.number().min(0.01).max(100),
						})
					)
					.min(1),
				message: z.string().max(1000).optional().describe('Optional deployment note.'),
			}),
			annotations: {
				title: 'Create Worker deployment',
				destructiveHint: true,
				openWorldHint: true,
			},
		},
		async ({ scriptName: name, versions, message }, accountId) => {
			if (
				Math.abs(versions.reduce((total, version) => total + version.percentage, 0) - 100) > 1e-8
			) {
				return apiError(
					'creating Worker deployment',
					new Error('Version percentages must sum to exactly 100.')
				)
			}
			try {
				const props = requireRequestProps(context)
				const deployment = await createWorkerDeployment({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					versions: versions.map(({ versionId: version_id, percentage }) => ({
						version_id,
						percentage,
					})),
					message,
				})
				return jsonResult(deployment)
			} catch (error) {
				return apiError('creating Worker deployment', error)
			}
		}
	)

	context.accountTool(
		'workers_deployments_delete',
		{
			description: fmt.trim(`
				Delete an older deployment by explicit UUID. Cloudflare does not allow deleting the
				latest deployment that is actively serving traffic.
			`),
			inputSchema: z.object({ scriptName, deploymentId }),
			annotations: {
				title: 'Delete Worker deployment',
				destructiveHint: true,
				openWorldHint: true,
			},
		},
		async ({ scriptName: name, deploymentId: id }, accountId) => {
			try {
				const props = requireRequestProps(context)
				const result = await deleteWorkerDeployment({
					apiToken: props.accessToken,
					accountId,
					scriptName: name,
					deploymentId: id,
				})
				return jsonResult(result)
			} catch (error) {
				return apiError('deleting Worker deployment', error)
			}
		}
	)
}

function jsonResult(value: unknown) {
	return textResult(JSON.stringify(value, null, 2))
}

function textResult(text: string) {
	return { content: [{ type: 'text' as const, text }] }
}

function apiError(action: string, error: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: `Error ${action}: ${error instanceof Error ? error.message : String(error)}`,
			},
		],
		isError: true,
	}
}
