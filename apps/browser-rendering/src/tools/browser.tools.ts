import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { BrowserMCP } from '../browser.app'

export function registerBrowserTools(agent: BrowserMCP) {
	agent.server.accountTool(
		'get_url_html_content',
		'Get page HTML content',
		{
			url: z.string().url(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client.browserRendering.content.create({
					account_id: accountId,
					url: params.url,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page html: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_markdown',
		'Get page converted into Markdown',
		{
			url: z.string().url(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/markdown`, {
					body: {
						url: params.url,
					},
				})) as { result: string }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.result,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page in markdown: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_screenshot',
		'Get page screenshot',
		{
			url: z.string().url(),
			viewport: z
				.object({
					height: z.number().default(600),
					width: z.number().default(800),
				})
				.optional(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client
					.post(`/accounts/${accountId}/browser-rendering/screenshot`, {
						body: {
							url: params.url,
							viewport: params.viewport,
						},
						__binaryResponse: true,
					})
					.asResponse()

				const arrayBuffer = await r.arrayBuffer()
				const base64Image = Buffer.from(arrayBuffer).toString('base64')

				return {
					content: [
						{
							type: 'image',
							mimeType: 'image/png',
							data: base64Image,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page screenshot: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_pdf',
		'Render a page to PDF',
		{
			url: z.string().url(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = await client
					.post(`/accounts/${accountId}/browser-rendering/pdf`, {
						body: {
							url: params.url,
						},
						__binaryResponse: true,
					})
					.asResponse()

				const arrayBuffer = await r.arrayBuffer()
				const base64Pdf = Buffer.from(arrayBuffer).toString('base64')

				return {
					content: [
						{
							type: 'resource',
							resource: {
								uri: params.url,
								mimeType: 'application/pdf',
								blob: base64Pdf,
							},
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page pdf: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_snapshot',
		'Get page HTML content and a screenshot in a single call',
		{
			url: z.string().url(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/snapshot`, {
					body: {
						url: params.url,
					},
				})) as { result: { content?: string; screenshot?: string } }

				const content: Array<
					{ type: 'text'; text: string } | { type: 'image'; mimeType: string; data: string }
				> = [
					{
						type: 'text',
						text: JSON.stringify({ content: r.result?.content }),
					},
				]

				if (r.result?.screenshot) {
					content.push({
						type: 'image',
						mimeType: 'image/png',
						data: r.result.screenshot,
					})
				}

				return { content }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page snapshot: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'scrape_url_elements',
		'Scrape elements from a page by CSS selector',
		{
			url: z.string().url(),
			elements: z
				.array(
					z.object({
						selector: z.string(),
					})
				)
				.min(1)
				.describe('CSS selectors of the elements to scrape'),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/scrape`, {
					body: {
						url: params.url,
						elements: params.elements,
					},
				})) as { result: unknown }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r.result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error scraping page: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_json',
		'Extract structured JSON from a page using AI. Provide a prompt and/or a response_format JSON schema to guide extraction.',
		{
			url: z.string().url(),
			prompt: z.string().optional().describe('Natural-language instruction for what to extract'),
			response_format: z
				.object({
					type: z.string(),
					json_schema: z.unknown().optional(),
				})
				.optional()
				.describe('Optional JSON-schema response format to constrain the output'),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/json`, {
					body: {
						url: params.url,
						...(params.prompt ? { prompt: params.prompt } : {}),
						...(params.response_format ? { response_format: params.response_format } : {}),
					},
				})) as { result: unknown }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r.result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page json: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_url_links',
		'Get the list of links on a page',
		{
			url: z.string().url(),
			visibleLinksOnly: z
				.boolean()
				.optional()
				.describe('Only return links that are visible in the rendered page'),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/links`, {
					body: {
						url: params.url,
						...(params.visibleLinksOnly !== undefined
							? { visibleLinksOnly: params.visibleLinksOnly }
							: {}),
					},
				})) as { result: unknown }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r.result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting page links: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'start_crawl',
		'Start an asynchronous crawl of a website. Returns a job_id — poll get_crawl_result to retrieve records.',
		{
			url: z.string().url(),
			render: z
				.boolean()
				.default(true)
				.describe('Whether to render pages with a browser (vs. fetching raw HTML)'),
			depth: z.number().int().min(0).optional().describe('How many links deep to crawl'),
			limit: z.number().int().min(1).optional().describe('Maximum number of pages to crawl'),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/crawl`, {
					body: {
						url: params.url,
						render: params.render,
						...(params.depth !== undefined ? { depth: params.depth } : {}),
						...(params.limit !== undefined ? { limit: params.limit } : {}),
					},
				})) as { result: string }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								job_id: r.result,
								message: 'Crawl started. Poll get_crawl_result with this job_id.',
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error starting crawl: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'get_crawl_result',
		'Get the status and records of a crawl job started with start_crawl',
		{
			job_id: z.string(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.get(
					`/accounts/${accountId}/browser-rendering/crawl/${params.job_id}`
				)) as { result: unknown }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r.result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting crawl result: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'cancel_crawl',
		'Cancel a running crawl job',
		{
			job_id: z.string(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.delete(
					`/accounts/${accountId}/browser-rendering/crawl/${params.job_id}`
				)) as { result: unknown }

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result: r.result ?? 'cancelled' }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error cancelling crawl: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'list_browser_sessions',
		'List active Browser Run sessions for the account',
		{},
		async (_params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				// This endpoint returns a bare JSON array of sessions, not the
				// usual `{ success, result }` envelope, so use the response as-is.
				const r = (await client.get(
					`/accounts/${accountId}/browser-rendering/devtools/session`
				)) as unknown
				const result =
					r && typeof r === 'object' && 'result' in r ? (r as { result: unknown }).result : r

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing browser sessions: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	agent.server.accountTool(
		'kill_browser_session',
		'Close (kill) a Browser Run session by its session ID',
		{
			session_id: z.string(),
		},
		async (params, accountId) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				await client.delete(
					`/accounts/${accountId}/browser-rendering/devtools/browser/${params.session_id}`
				)

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								session_id: params.session_id,
								status: 'killed',
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error killing browser session: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
