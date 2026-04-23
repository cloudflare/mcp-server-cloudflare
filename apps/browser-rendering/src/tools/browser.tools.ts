import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { BrowserMCP } from '../browser.app'

export function registerBrowserTools(agent: BrowserMCP) {
	agent.server.tool(
		'get_url_html_content',
		'Retrieve the HTML content of a web page or URL. Use when the user wants to scrape, analyze, or inspect the raw HTML source code of a website or web page. Do not use when you need to search Cloudflare's official documentation (use search_cloudflare_documentation instead). Accepts `url` (required string), e.g., "https://example.com" or "https://blog.cloudflare.com/workers-ai". Raises an error if the URL is unreachable or returns a non-HTML response. "https://example.com" or "https://docs.cloudflare.com/workers/". Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead). Returns the complete HTML markup as a string. Raises an error if the URL is unreachable or returns a non-HTML response.',
		{
			url: z.string().url(),
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
				}
			}
		}
	)

	agent.server.tool(
		'get_url_markdown',
		'Retrieve and convert a web page into Markdown format for easier reading and processing. Use when the user wants to extract clean, formatted text content from a website or URL for analysis, documentation, or content review. Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead). Accepts `url` (required string), e.g., "https://example.com/article". Raises an error if the URL is inaccessible or returns non-HTML content. "https://example.com/article" or "https://docs.cloudflare.com/workers/". Do not use when you need to search Cloudflare-specific documentation (use search_cloudflare_documentation instead). Returns error if the URL is inaccessible or the page cannot be converted to Markdown format.',
		{
			url: z.string().url(),
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
				}
			}
		}
	)

	agent.server.tool(
		'get_url_screenshot',
		'Capture a screenshot of a web page at a specified URL. Use when the user wants to visually inspect, document, or verify the appearance of a website or web application. Do not use when you need to search or read Cloudflare documentation content (use search_cloudflare_documentation instead). Accepts `url` (required) and optional parameters like `viewport_width`, `viewport_height`, and `full_page` for complete page capture. e.g., url="https://example.com", viewport_width=1920, full_page=true. Raises an error if the URL is unreachable or the page fails to load within the timeout period."https://example.com" with full_page=true for entire page screenshots. Returns an error if the URL is inaccessible, times out, or contains invalid formatting. Do not use when you need to search Cloudflare documentation content (use search_cloudflare_documentation instead).',
		{
			url: z.string().url(),
			viewport: z
				.object({
					height: z.number().default(600),
					width: z.number().default(800),
				})
				.optional(),
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
				}
			}
		}
	)
}
