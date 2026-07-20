import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testStatelessMcpApp } from '@repo/mcp-common/src/test/stateless-app'

import worker, { BUILDS_INSTRUCTIONS, mcpHandler } from './workers-builds.app'

import type { Env } from './workers-builds.context'

const { listBuildsMock, getBuildMock, getBuildLogsMock } = vi.hoisted(() => ({
	listBuildsMock: vi.fn(),
	getBuildMock: vi.fn(),
	getBuildLogsMock: vi.fn(),
}))

vi.mock('@repo/mcp-common/src/api/workers-builds.api', () => ({
	listBuilds: listBuildsMock,
	getBuild: getBuildMock,
	getBuildLogs: getBuildLogsMock,
}))

testStatelessMcpApp<Env>({
	name: 'Workers Builds',
	handler: mcpHandler,
	env: env as unknown as Env,
	url: 'https://builds.mcp.cloudflare.com',
	authenticated: true,
	authenticatedWorker: worker,
	expectedTools: [
		'workers_builds_list_builds',
		'workers_builds_get_build',
		'workers_builds_get_build_logs',
	],
	absentTools: ['workers_builds_set_active_worker', 'workers_builds_set_active_build'],
	requiredToolInputs: {
		workers_builds_list_builds: ['workerId'],
		workers_builds_get_build: ['buildUUID'],
		workers_builds_get_build_logs: ['buildUUID'],
	},
})

function context(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'builds-token',
			account: { id: 'account-1', name: 'Build account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

function toolCall(arguments_: Record<string, unknown>) {
	return new Request('https://builds.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/call',
			'Mcp-Name': 'workers_builds_list_builds',
			Host: 'builds.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 'builds-call',
			method: 'tools/call',
			params: {
				name: 'workers_builds_list_builds',
				arguments: arguments_,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'builds-test', version: '1.0.0' },
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

beforeEach(() => {
	listBuildsMock.mockReset()
	getBuildMock.mockReset()
	getBuildLogsMock.mockReset()
})

describe('Workers Builds stateless state boundary', () => {
	it('documents only explicit worker and build identifiers', () => {
		expect(BUILDS_INSTRUCTIONS).toContain('workerId')
		expect(BUILDS_INSTRUCTIONS).toContain('build UUID')
		expect(BUILDS_INSTRUCTIONS).not.toMatch(/active worker|active build|set_active/i)
	})

	it('rejects a list call without workerId before invoking the API', async () => {
		const response = await mcpHandler.fetch(toolCall({}), env as unknown as Env, context())
		const document = await responseDocument(response)

		expect(response.status).toBe(200)
		expect(document.result).toMatchObject({ isError: true })
		expect(listBuildsMock).not.toHaveBeenCalled()
	})

	it('forwards the explicit workerId and request-scoped credentials to the API', async () => {
		listBuildsMock.mockResolvedValueOnce({ result: undefined })
		const response = await mcpHandler.fetch(
			toolCall({ workerId: 'worker-123' }),
			env as unknown as Env,
			context()
		)
		const document = await responseDocument(response)

		expect(response.status).toBe(200)
		expect(document.result.content[0].text).toBe('No builds found')
		expect(listBuildsMock).toHaveBeenCalledWith({
			apiToken: 'builds-token',
			accountId: 'account-1',
			workerId: 'worker-123',
			page: 1,
			perPage: 10,
		})
	})
})
