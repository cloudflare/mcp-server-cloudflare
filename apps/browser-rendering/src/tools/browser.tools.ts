import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { BrowserMCP } from '../browser.app'

const browserRequestZodObject = z.object({
	url: z.string().url(),
	authenticate: z.object({
		username: z.string(),
		password: z.string(),
	}).optional(),
	gotoOptions: z.object({
		referer: z.string().url().optional(),
		waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('networkidle2'),
		timeout: z.number().default(30000),
	}).optional(),
	cookies: z.array(
		z.object({
			name: z.string(),
			value: z.string(),
		})
	).optional(),
	userAgent: z.string().optional(),
	setExtraHTTPHeaders: z.record(z.string()).optional(),
})

const browserRequestSchema = browserRequestZodObject.shape

const screenshotRequestZodObject = browserRequestZodObject.extend({
	viewport: z.object({
		height: z.number().default(600),
		width: z.number().default(800),
	}).optional(),
	screenshotOptions: z.object({
		captureBeyondViewport: z.boolean().optional(),
		clip: z.object({
			height: z.number(),
			width: z.number(),
			x: z.number(),
			y: z.number(),
			scale: z.number().optional(),
		}).optional(),
		encoding: z.enum(['binary', 'base64']).default('binary').optional(),
		fromSurface: z.boolean().optional(),
		fullPage: z.boolean().optional(),
		omitBackground: z.boolean().optional(),
		optimizeForSpeed: z.boolean().optional(),
		quality: z.number().optional(),
		type: z.enum(['png', 'jpeg', 'webp']).default('png').optional(),
	}).optional(),
})

export function registerBrowserTools(agent: BrowserMCP) {
	agent.server.tool(
		'get_url_html_content',
		'Get page HTML content',
		browserRequestSchema,
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
					...browserRequestZodObject.parse(params),
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
		browserRequestSchema,
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
				console.log('Requesting markdown rendering with params:', params)
				const r = (await client.post(`/accounts/${accountId}/browser-rendering/markdown`, {
					body: { ...browserRequestZodObject.parse(params) },
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
		screenshotRequestZodObject.shape,
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
						body: { ...screenshotRequestZodObject.parse(params) },
						__binaryResponse: true,
					})
					.asResponse()

				const arrayBuffer = await r.arrayBuffer()
				const base64Image = Buffer.from(arrayBuffer).toString('base64')
				const imageType = params.screenshotOptions?.type ?? 'png'
				const mimeType = `image/${imageType}` as 'image/png' | 'image/jpeg' | 'image/webp'

				if (params.screenshotOptions?.encoding === 'base64') {
					return {
						content: [
							{
								type: 'text',
								text: base64Image,
							},
						],
					}
				}

				return {
					content: [
						{
							type: 'image',
							mimeType,
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
