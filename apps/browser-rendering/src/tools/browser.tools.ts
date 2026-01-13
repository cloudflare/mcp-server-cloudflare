import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { BrowserMCP } from '../browser.app'

export function registerBrowserTools(agent: BrowserMCP) {
	agent.server.tool(
		'get_url_html_content',
		'Get page HTML content',
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
		'Get page converted into Markdown',
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
