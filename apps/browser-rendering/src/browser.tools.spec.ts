import { Cloudflare } from 'cloudflare'
import { env } from 'cloudflare:test'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@repo/mcp-common/src/test/msw-server'

import { mcpHandler } from './browser.app'

import type { JsonBodyType } from 'msw'
import type * as CloudflareApi from '@repo/mcp-common/src/cloudflare-api'
import type { Env } from './browser.context'

// The SDK's default `fetch` is the global it saw at import time, before MSW patched it.
// Pass a `fetch` that reads the global per call, so MSW intercepts the SDK's requests.
vi.mock('@repo/mcp-common/src/cloudflare-api', async (importOriginal) => ({
	...(await importOriginal<typeof CloudflareApi>()),
	getCloudflareClient: (apiToken: string) =>
		new Cloudflare({ apiToken, fetch: (url, init) => globalThis.fetch(url, init) }),
}))

const API = 'https://api.cloudflare.com/client/v4/accounts/account-1'

function context(): ExecutionContext {
	return {
		props: {
			type: 'account_token',
			accessToken: 'browser-token',
			account: { id: 'account-1', name: 'Browser account' },
		},
		waitUntil() {},
		passThroughOnException() {},
	} as ExecutionContext
}

function toolCallRequest(name: string, args: Record<string, unknown>) {
	return new Request('https://browser.mcp.cloudflare.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/call',
			'Mcp-Name': name,
			Host: 'browser.mcp.cloudflare.com',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: crypto.randomUUID(),
			method: 'tools/call',
			params: {
				name,
				arguments: args,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'browser-test', version: '1.0.0' },
					'io.modelcontextprotocol/clientCapabilities': {},
				},
			},
		}),
	})
}

type ToolCallDocument = {
	result?: { isError?: boolean; content: Array<{ type: string; text?: string }> }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallDocument> {
	const response = await mcpHandler.fetch(
		toolCallRequest(name, args),
		env as unknown as Env,
		context()
	)
	const text = await response.text()
	const data = response.headers.get('content-type')?.includes('application/json')
		? text
		: text
				.split('\n')
				.find((line) => line.startsWith('data: '))
				?.slice('data: '.length)
	if (!data) throw new Error(`Expected an MCP response document, received: ${text}`)
	return JSON.parse(data)
}

function expectSuccess(document: ToolCallDocument) {
	expect(document.result?.isError, JSON.stringify(document)).toBeFalsy()
}

/** Captures the outbound request to the account API `path` and answers with `body`. */
function captureRequest(path: string, body: JsonBodyType = { success: true, result: 'ok' }) {
	const seen: { url?: URL; body?: unknown } = {}
	server.use(
		http.post(`${API}/${path}`, async ({ request }) => {
			seen.url = new URL(request.url)
			seen.body = await request.json()
			return HttpResponse.json(body)
		})
	)
	return seen
}

describe('Browser Run browser selection', () => {
	const quickActions: Array<[tool: string, path: string, args: Record<string, unknown>]> = [
		['get_url_html_content', 'browser-rendering/content', {}],
		['get_url_markdown', 'browser-run/markdown', {}],
		['get_url_snapshot', 'browser-run/snapshot', {}],
		['scrape_url_elements', 'browser-run/scrape', { elements: [{ selector: 'h1' }] }],
		['get_url_json', 'browser-run/json', { prompt: 'Get the title' }],
		['get_url_links', 'browser-run/links', {}],
	]

	it.each(quickActions)('%s sends ?browser=kitesurf to /%s', async (tool, path, args) => {
		const seen = captureRequest(path)

		const document = await callTool(tool, {
			url: 'https://example.com',
			browser: 'kitesurf',
			...args,
		})

		expectSuccess(document)
		expect(seen.url?.searchParams.get('browser')).toBe('kitesurf')
		expect(seen.body).not.toHaveProperty('browser')
	})

	it.each(quickActions)('%s omits the browser param by default', async (tool, path, args) => {
		const seen = captureRequest(path)

		const document = await callTool(tool, { url: 'https://example.com', ...args })

		expectSuccess(document)
		expect(seen.url?.searchParams.has('browser')).toBe(false)
	})

	it.each([
		['get_url_screenshot', 'browser-run/screenshot'],
		['get_url_pdf', 'browser-run/pdf'],
	])('%s sends ?browser=kitesurf to /%s', async (tool, path) => {
		const seen: { url?: URL } = {}
		server.use(
			http.post(`${API}/${path}`, ({ request }) => {
				seen.url = new URL(request.url)
				return new HttpResponse(new Uint8Array([1, 2, 3]), {
					headers: { 'content-type': 'application/octet-stream' },
				})
			})
		)

		const document = await callTool(tool, { url: 'https://example.com', browser: 'kitesurf' })

		expectSuccess(document)
		expect(seen.url?.searchParams.get('browser')).toBe('kitesurf')
	})

	it('start_crawl sends browser in the body, not the query', async () => {
		const seen = captureRequest('browser-run/crawl', { success: true, result: 'job-1' })

		const document = await callTool('start_crawl', {
			url: 'https://example.com',
			browser: 'kitesurf',
		})

		expectSuccess(document)
		expect(seen.url?.searchParams.has('browser')).toBe(false)
		expect(seen.body).toMatchObject({ url: 'https://example.com', browser: 'kitesurf' })
	})

	it('start_crawl rejects browser when render is false', async () => {
		const seen = captureRequest('browser-run/crawl')

		const document = await callTool('start_crawl', {
			url: 'https://example.com',
			render: false,
			browser: 'kitesurf',
		})

		expect(document.result?.isError).toBe(true)
		expect(document.result?.content[0].text).toContain('render is true')
		expect(seen.url).toBeUndefined()
	})

	it('rejects browsers other than kitesurf', async () => {
		const seen = captureRequest('browser-rendering/content')

		const document = await callTool('get_url_html_content', {
			url: 'https://example.com',
			browser: 'firefox',
		})

		expect(document.result?.isError).toBe(true)
		expect(seen.url).toBeUndefined()
	})
})
