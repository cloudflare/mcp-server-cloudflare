import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { mcpHandler } from './workers-scripts.app'

import type { Env } from './workers-scripts.context'

const apiMocks = vi.hoisted(() => ({
	listWorkerScripts: vi.fn(),
	downloadWorkerScript: vi.fn(),
	uploadWorkerScript: vi.fn(),
	uploadWorkerVersion: vi.fn(),
	deleteWorkerScript: vi.fn(),
	listWorkerVersions: vi.fn(),
	listWorkerDeployments: vi.fn(),
	getWorkerDeployment: vi.fn(),
	createWorkerDeployment: vi.fn(),
	deleteWorkerDeployment: vi.fn(),
}))

vi.mock('./api/workers-scripts.api', () => apiMocks)

testStatelessMcpApp<Env>({
	name: 'Workers Scripts',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://workers.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: [
		'workers_scripts_list',
		'workers_scripts_download',
		'workers_scripts_upload',
		'workers_versions_upload',
		'workers_scripts_delete',
		'workers_versions_list',
		'workers_deployments_list',
		'workers_deployments_get',
		'workers_deployments_create',
		'workers_deployments_delete',
	],
	requiredToolInputs: {
		workers_scripts_download: ['scriptName'],
		workers_scripts_upload: ['scriptName', 'script', 'compatibilityDate'],
		workers_versions_upload: ['scriptName', 'script', 'compatibilityDate'],
		workers_scripts_delete: ['scriptName'],
		workers_versions_list: ['scriptName'],
		workers_deployments_list: ['scriptName'],
		workers_deployments_get: ['scriptName', 'deploymentId'],
		workers_deployments_create: ['scriptName', 'versions'],
		workers_deployments_delete: ['scriptName', 'deploymentId'],
	},
})

function toolCall(name: string, arguments_: Record<string, unknown>) {
	return new Request('https://workers.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/call',
			'Mcp-Name': name,
			Host: 'workers.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'workers-scripts-call',
			method: 'tools/call',
			params: {
				name,
				arguments: arguments_,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'workers-scripts-test', version: '1.0.0' },
					'io.modelcontextprotocol/clientCapabilities': {},
				},
			},
		}),
	})
}

async function responseDocument(response: Response): Promise<Record<string, any>> {
	const text = await response.text()
	if (response.headers.get('content-type')?.includes('application/json')) return JSON.parse(text)
	const data = text
		.split('\n')
		.find((line) => line.startsWith('data: '))
		?.slice('data: '.length)
	if (!data) throw new Error(`Expected an MCP response document, received: ${text}`)
	return JSON.parse(data)
}

function executionContext(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'workers-scripts-token',
			account: { id: 'account-1', name: 'Scripts account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

async function callTool(name: string, arguments_: Record<string, unknown>) {
	const response = await mcpHandler.fetch(
		toolCall(name, arguments_),
		env as unknown as Env,
		executionContext()
	)
	return responseDocument(response)
}

beforeEach(() => {
	for (const mock of Object.values(apiMocks)) mock.mockReset()
})

describe('Workers Scripts tools', () => {
	it('passes request-scoped credentials to script upload', async () => {
		apiMocks.uploadWorkerScript.mockResolvedValueOnce({ id: 'example-worker' })

		const document = await callTool('workers_scripts_upload', {
			scriptName: 'example-worker',
			script: 'export default { fetch() { return new Response("ok") } }',
			compatibilityDate: '2025-03-10',
		})

		expect(document.result.isError).toBeUndefined()
		expect(apiMocks.uploadWorkerScript).toHaveBeenCalledWith({
			apiToken: 'workers-scripts-token',
			accountId: 'account-1',
			scriptName: 'example-worker',
			script: 'export default { fetch() { return new Response("ok") } }',
			compatibilityDate: '2025-03-10',
			compatibilityFlags: undefined,
			message: undefined,
		})
	})

	it('rejects a deployment whose version percentages do not total 100', async () => {
		const document = await callTool('workers_deployments_create', {
			scriptName: 'example-worker',
			versions: [{ versionId: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02', percentage: 90 }],
		})

		expect(document.result.isError).toBe(true)
		expect(document.result.content[0].text).toContain('sum to exactly 100')
		expect(apiMocks.createWorkerDeployment).not.toHaveBeenCalled()
	})

	it('maps explicit version IDs into the deployment API request', async () => {
		apiMocks.createWorkerDeployment.mockResolvedValueOnce({ id: 'deployment-1' })

		await callTool('workers_deployments_create', {
			scriptName: 'example-worker',
			versions: [{ versionId: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02', percentage: 100 }],
		})

		expect(apiMocks.createWorkerDeployment).toHaveBeenCalledWith({
			apiToken: 'workers-scripts-token',
			accountId: 'account-1',
			scriptName: 'example-worker',
			versions: [{ version_id: 'a34c4e4f-f78f-49bd-89e1-056c2c8d8d02', percentage: 100 }],
			message: undefined,
		})
	})

	it('deletes only the explicitly named script', async () => {
		const document = await callTool('workers_scripts_delete', {
			scriptName: 'retired-worker',
		})

		expect(document.result.isError).toBeUndefined()
		expect(apiMocks.deleteWorkerScript).toHaveBeenCalledWith({
			apiToken: 'workers-scripts-token',
			accountId: 'account-1',
			scriptName: 'retired-worker',
		})
	})
})
