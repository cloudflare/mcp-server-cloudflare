import { describe, expect, it, vi } from 'vitest'

import { formatDocsResults, queryAiSearch, registerDocsTools } from './docs-ai-search.tools'

const aiSearchResponse = {
	search_query: 'workers kv binding example',
	chunks: [
		{
			id: 'chunk-1',
			type: 'text',
			score: 0.8,
			text: 'Create a KV namespace.',
			item: { key: 'workers/runtime-apis/kv/index.md' },
		},
		{
			id: 'other-chunk',
			type: 'text',
			score: 0.85,
			text: 'Configure a Worker.',
			item: { key: 'workers/configuration/index.md' },
		},
		{
			id: 'chunk-2',
			type: 'text',
			score: 0.93,
			text: 'Bind it to your Worker.',
			item: { key: 'workers/runtime-apis/kv/index.md', metadata: { section: 'bindings' } },
		},
	],
}

function makeAiSearch(response: unknown): {
	instance: AiSearchInstance
	search: ReturnType<typeof vi.fn>
} {
	const search = vi.fn().mockResolvedValue(response)
	return {
		instance: { search } as unknown as AiSearchInstance,
		search,
	}
}

describe('docs AI Search tools', () => {
	it('maps every chunk in exact response order', async () => {
		const { instance, search } = makeAiSearch(aiSearchResponse)

		const results = await queryAiSearch(instance, 'workers kv binding example')

		expect(search).toHaveBeenCalledWith({
			query: 'workers kv binding example',
		})
		expect(results).toEqual([
			{
				similarity: 0.8,
				id: 'chunk-1',
				url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
				title: 'kv',
				text: 'Create a KV namespace.',
			},
			{
				similarity: 0.85,
				id: 'other-chunk',
				url: 'https://developers.cloudflare.com/workers/configuration/',
				title: 'configuration',
				text: 'Configure a Worker.',
			},
			{
				similarity: 0.93,
				id: 'chunk-2',
				url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
				title: 'kv',
				text: 'Bind it to your Worker.',
			},
		])
	})

	it('keeps absolute documentation URLs from AI Search unchanged', async () => {
		const { instance } = makeAiSearch({
			...aiSearchResponse,
			chunks: [
				{
					...aiSearchResponse.chunks[0],
					item: {
						key: 'https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/index.mdx',
					},
				},
			],
		})

		const [result] = await queryAiSearch(instance, 'remote MCP transport')

		expect(result).toMatchObject({
			url: 'https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/',
			title: 'transport',
		})
	})

	it('formats unstructured content as XML-style result blocks', () => {
		expect(
			formatDocsResults([
				{
					similarity: 0.93,
					id: 'file-1',
					url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
					title: 'KV',
					text: 'Create a KV namespace.',
				},
			])
		).toBe(`<result>
<url>https://developers.cloudflare.com/workers/runtime-apis/kv/</url>
<title>KV</title>
<text>
Create a KV namespace.
</text>
</result>`)
	})

	it('registers outputSchema and returns structuredContent', async () => {
		const { instance } = makeAiSearch(aiSearchResponse)
		const registeredTools = new Map<string, { options: any; handler: any }>()
		const registerTool = vi.fn((name: string, options: any, handler: any) => {
			registeredTools.set(name, { options, handler })
		})

		registerDocsTools({ registerTool, env: { DOCS_AI_SEARCH: instance } } as any)

		const docsTool = registeredTools.get('search_cloudflare_documentation')
		expect(docsTool?.options.outputSchema).toBeDefined()
		expect(docsTool?.options.outputSchema.shape.results).toBeDefined()

		const response = await docsTool?.handler({ query: 'workers kv binding example' })

		expect(response.structuredContent).toEqual({
			results: [
				{
					similarity: 0.8,
					id: 'chunk-1',
					url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
					title: 'kv',
					text: 'Create a KV namespace.',
				},
				{
					similarity: 0.85,
					id: 'other-chunk',
					url: 'https://developers.cloudflare.com/workers/configuration/',
					title: 'configuration',
					text: 'Configure a Worker.',
				},
				{
					similarity: 0.93,
					id: 'chunk-2',
					url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
					title: 'kv',
					text: 'Bind it to your Worker.',
				},
			],
		})
		expect(response.content[0].text).toContain('<result>')
	})
})
