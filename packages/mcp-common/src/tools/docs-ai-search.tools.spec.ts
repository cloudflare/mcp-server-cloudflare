import { describe, expect, it, vi } from 'vitest'

import { formatDocsResults, queryAiSearch, registerDocsTools } from './docs-ai-search.tools'

const aiSearchResponse = {
	object: 'vector_store.search_results.page',
	search_query: 'workers kv binding example',
	data: [
		{
			file_id: 'file-1',
			filename: 'workers/runtime-apis/kv/index.md',
			score: 0.93,
			attributes: {},
			content: [
				{ id: 'chunk-1', type: 'text', text: 'Create a KV namespace.' },
				{ id: 'chunk-2', type: 'text', text: 'Bind it to your Worker.' },
			],
		},
	],
	has_more: false,
	next_page: null,
}

function makeAi(response: unknown): { ai: Ai; search: ReturnType<typeof vi.fn> } {
	const search = vi.fn().mockResolvedValue(response)
	return {
		ai: {
			autorag: vi.fn(() => ({ search })),
		} as unknown as Ai,
		search,
	}
}

describe('docs AI Search tools', () => {
	it('queries AI Search and maps results', async () => {
		const { ai, search } = makeAi(aiSearchResponse)

		const results = await queryAiSearch(ai, 'workers kv binding example')

		expect(ai.autorag).toHaveBeenCalledWith('docs-mcp-rag')
		expect(search).toHaveBeenCalledWith({
			query: 'workers kv binding example',
		})
		expect(results).toEqual([
			{
				similarity: 0.93,
				id: 'file-1',
				url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
				title: 'kv',
				text: 'Create a KV namespace.\nBind it to your Worker.',
			},
		])
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
		const { ai } = makeAi(aiSearchResponse)
		const registeredTools = new Map<string, { options: any; handler: any }>()
		const server = {
			registerTool: vi.fn((name: string, options: any, handler: any) => {
				registeredTools.set(name, { options, handler })
			}),
		}

		registerDocsTools(server as any, { AI: ai })

		const docsTool = registeredTools.get('search_cloudflare_documentation')
		expect(docsTool?.options.outputSchema).toBeDefined()
		expect(docsTool?.options.outputSchema.results).toBeDefined()

		const response = await docsTool?.handler({ query: 'workers kv binding example' })

		expect(response.structuredContent).toEqual({
			results: [
				{
					similarity: 0.93,
					id: 'file-1',
					url: 'https://developers.cloudflare.com/workers/runtime-apis/kv/',
					title: 'kv',
					text: 'Create a KV namespace.\nBind it to your Worker.',
				},
			],
		})
		expect(response.content[0].text).toContain('<result>')
	})
})
