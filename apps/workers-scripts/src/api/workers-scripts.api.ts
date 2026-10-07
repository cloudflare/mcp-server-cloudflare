import { z } from 'zod'

import { throwUpstreamApiError } from '@repo/mcp-common/src/mcp-error'
import { cloudflareFetch } from '@repo/mcp-common/src/user-agent'

import { WorkerDeployment, WorkerScript, WorkerVersion } from '../types/workers-scripts.types'

export async function listWorkerScripts({
	accountId,
	apiToken,
}: {
	accountId: string
	apiToken: string
}) {
	return requestJson({
		accountId,
		apiToken,
		endpoint: '/workers/scripts',
		schema: z.array(WorkerScript),
	})
}

export async function downloadWorkerScript({
	accountId,
	apiToken,
	scriptName,
}: {
	accountId: string
	apiToken: string
	scriptName: string
}) {
	const response = await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}`,
	})
	return {
		contentType: response.headers.get('content-type') ?? 'text/plain',
		content: await response.text(),
	}
}

export async function uploadWorkerScript({
	accountId,
	apiToken,
	scriptName,
	script,
	compatibilityDate,
	compatibilityFlags,
	message,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	script: string
	compatibilityDate: string
	compatibilityFlags?: string[]
	message?: string
}) {
	const existingConfig = await getExistingWorkerConfig({ accountId, apiToken, scriptName })
	const form = createUploadForm({
		script,
		compatibilityDate,
		compatibilityFlags: compatibilityFlags ?? existingConfig.compatibilityFlags,
		message,
		bindings: existingConfig.bindings,
	})
	const response = await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}?bindings_inherit=strict`,
		options: { method: 'PUT', body: form },
	})
	return parseApiResult(response)
}

export async function uploadWorkerVersion({
	accountId,
	apiToken,
	scriptName,
	script,
	compatibilityDate,
	compatibilityFlags,
	message,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	script: string
	compatibilityDate: string
	compatibilityFlags?: string[]
	message?: string
}) {
	const existingConfig = await getExistingWorkerConfig({ accountId, apiToken, scriptName })
	const form = createUploadForm({
		script,
		compatibilityDate,
		compatibilityFlags: compatibilityFlags ?? existingConfig.compatibilityFlags,
		message,
		bindings: existingConfig.bindings,
	})
	const response = await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/versions?bindings_inherit=strict`,
		options: { method: 'POST', body: form },
	})
	return parseApiResult(response)
}

export async function deleteWorkerScript({
	accountId,
	apiToken,
	scriptName,
}: {
	accountId: string
	apiToken: string
	scriptName: string
}) {
	await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}`,
		options: { method: 'DELETE' },
	})
}

export async function listWorkerVersions({
	accountId,
	apiToken,
	scriptName,
	page,
	perPage,
	deployable,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	page: number
	perPage: number
	deployable: boolean
}) {
	const query = new URLSearchParams({
		page: String(page),
		per_page: String(perPage),
		deployable: String(deployable),
	})
	return requestJson({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/versions?${query}`,
		schema: z
			.object({ items: z.array(WorkerVersion).optional() })
			.passthrough()
			.transform(({ items }) => items ?? []),
	})
}

export async function listWorkerDeployments({
	accountId,
	apiToken,
	scriptName,
	page,
	perPage,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	page: number
	perPage: number
}) {
	const query = new URLSearchParams({ page: String(page), per_page: String(perPage) })
	return requestJson({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/deployments?${query}`,
		schema: z
			.object({ deployments: z.array(WorkerDeployment) })
			.passthrough()
			.transform(({ deployments }) => deployments),
	})
}

export async function getWorkerDeployment({
	accountId,
	apiToken,
	scriptName,
	deploymentId,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	deploymentId: string
}) {
	return requestJson({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/deployments/${encodeURIComponent(deploymentId)}`,
		schema: WorkerDeployment,
	})
}

export async function createWorkerDeployment({
	accountId,
	apiToken,
	scriptName,
	versions,
	message,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	versions: Array<{ version_id: string; percentage: number }>
	message?: string
}) {
	const response = await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/deployments`,
		options: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				strategy: 'percentage',
				versions,
				...(message ? { annotations: { 'workers/message': message } } : {}),
			}),
		},
	})
	return parseApiResult(response)
}

export async function deleteWorkerDeployment({
	accountId,
	apiToken,
	scriptName,
	deploymentId,
}: {
	accountId: string
	apiToken: string
	scriptName: string
	deploymentId: string
}) {
	const response = await requestWorkerApi({
		accountId,
		apiToken,
		endpoint: `/workers/scripts/${encodeURIComponent(scriptName)}/deployments/${encodeURIComponent(deploymentId)}`,
		options: { method: 'DELETE' },
	})
	const result = z
		.object({ success: z.boolean() })
		.passthrough()
		.parse(await response.json())
	if (!result.success) throw new Error('Cloudflare did not delete the Worker deployment')
	return result
}

async function requestJson<T extends z.ZodType>({
	accountId,
	apiToken,
	endpoint,
	schema,
}: {
	accountId: string
	apiToken: string
	endpoint: string
	schema: T
}): Promise<z.infer<T> | null> {
	const response = await requestWorkerApi({ accountId, apiToken, endpoint })
	const envelope = z.record(z.string(), z.unknown()).parse(await response.json())
	if (envelope.success !== true) {
		const errors = z.array(z.object({ message: z.string() })).safeParse(envelope.errors)
		throw new Error(
			errors.success
				? errors.data.map(({ message }) => message).join('; ')
				: 'Cloudflare Workers API reported an unsuccessful request'
		)
	}
	if (!Object.hasOwn(envelope, 'result') || envelope.result === null) return null
	return schema.parse(envelope.result)
}

async function requestWorkerApi({
	accountId,
	apiToken,
	endpoint,
	options = {},
}: {
	accountId: string
	apiToken: string
	endpoint: string
	options?: RequestInit
}): Promise<Response> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}${endpoint}`
	const headers = new Headers(options.headers)
	headers.set('Authorization', `Bearer ${apiToken}`)
	const response = await cloudflareFetch(url, { ...options, headers })

	if (!response.ok) {
		throwUpstreamApiError(response.status, 'Cloudflare Workers API', await response.text())
	}

	return response
}

async function parseApiResult(response: Response): Promise<unknown> {
	const body = await response.text()
	if (!body) throw new Error('Cloudflare Workers API returned an empty response')

	const payload = z
		.object({
			success: z.boolean(),
			errors: z.array(z.object({ message: z.string() }).passthrough()),
			result: z.unknown().optional(),
		})
		.passthrough()
		.parse(JSON.parse(body))
	if (!payload.success) {
		throw new Error(
			payload.errors.map(({ message }) => message).join('; ') ||
				'Cloudflare Workers API reported an unsuccessful request'
		)
	}
	if (payload.result === undefined || payload.result === null) {
		throw new Error('Cloudflare Workers API response did not include a result')
	}
	return payload.result
}

function createUploadForm({
	script,
	compatibilityDate,
	compatibilityFlags,
	message,
	bindings,
}: {
	script: string
	compatibilityDate: string
	compatibilityFlags?: string[]
	message?: string
	bindings: Array<{ name: string }>
}) {
	const form = new FormData()
	form.set(
		'metadata',
		JSON.stringify({
			main_module: 'worker.js',
			compatibility_date: compatibilityDate,
			bindings: bindings.map(({ name }) => ({
				type: 'inherit',
				name,
				version_id: 'latest',
			})),
			...(compatibilityFlags?.length ? { compatibility_flags: compatibilityFlags } : {}),
			...(message ? { annotations: { 'workers/message': message } } : {}),
		})
	)
	form.set('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js')
	return form
}

async function getExistingWorkerConfig({
	accountId,
	apiToken,
	scriptName,
}: {
	accountId: string
	apiToken: string
	scriptName: string
}): Promise<{ bindings: Array<{ name: string }>; compatibilityFlags?: string[] }> {
	const scripts = await listWorkerScripts({ accountId, apiToken })
	if (scripts === null) throw new Error('Could not verify existing Worker bindings before upload')

	const existingScript = scripts.find((script) => script.id === scriptName)
	return {
		bindings: existingScript?.bindings?.map(({ name }) => ({ name })) ?? [],
		compatibilityFlags: existingScript?.compatibility_flags,
	}
}
