import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import { pageParam, perPageParam } from '../types'

import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'

export function registerAutoRAGTools<Env>(context: McpRegistrationContext<Env>) {
	context.accountTool(
		'list_rags',
		{
			description: 'List AutoRAGs (vector stores)',
			inputSchema: z.object({
				page: pageParam,
				per_page: perPageParam,
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.get(`/accounts/${accountId}/autorag/rags`, {
					query: { page: params.page, per_page: params.per_page },
				})) as {
					result: Array<{ id: string; source: string; paused: boolean }>
					result_info: { total_count: number }
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								autorags: r.result.map((obj) => {
									return {
										id: obj.id,
										source: obj.source,
										paused: obj.paused,
									}
								}),
								total_count: r.result_info.total_count,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing rags: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'search',
		{
			description: 'Search Documents using AutoRAG (vector store)',
			inputSchema: z.object({
				rag_id: z.string().describe('ID of the AutoRAG to search'),
				query: z.string().describe('Query to search for. Can be a URL, a title, or a snippet.'),
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(
					`/accounts/${accountId}/autorag/rags/${params.rag_id}/search`,
					{
						body: {
							query: params.query,
							max_num_results: 5,
						},
					}
				)) as { result: { data: Array<{ filename: string; content: Array<{ text: string }> }> } }

				const chunks = r.result.data
					.map((item) => {
						const data = item.content
							.map((content) => {
								return content.text
							})
							.join('\n\n')

						return `<file name="${item.filename}">${data}</file>`
					})
					.join('\n\n')

				return {
					content: [
						{
							type: 'text',
							text: chunks,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error searching rag: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)

	context.accountTool(
		'ai_search',
		{
			description: 'AI Search Documents using AutoRAG (vector store)',
			inputSchema: z.object({
				rag_id: z.string().describe('ID of the AutoRAG to search'),
				query: z.string().describe('Query to search for. Can be a URL, a title, or a snippet.'),
			}),
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
				const client = getCloudflareClient(props.accessToken)
				const r = (await client.post(
					`/accounts/${accountId}/autorag/rags/${params.rag_id}/ai-search`,
					{
						body: {
							query: params.query,
							max_num_results: 10, // Limit can be bigger here, since llm is only getting the end response and not individual chunks
						},
					}
				)) as { result: { response: string } }

				return {
					content: [
						{
							type: 'text',
							text: r.result.response,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error searching rag: ${error instanceof Error && error.message}`,
						},
					],
					isError: true,
				}
			}
		}
	)
}
