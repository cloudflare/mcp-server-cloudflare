import { z } from 'zod'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RequiredEnv {
	AI: Ai
	VECTORIZE: VectorizeIndex
}

// Always return 10 results for simplicity, don't make it configurable
const TOP_K = 10

/**
 * Registers the docs search tool with the MCP server
 * @param server The MCP server instance
 */
export function registerDocsTools(server: McpServer, env: RequiredEnv) {
	server.tool(
		'search_cloudflare_documentation',
		`Search the Cloudflare documentation.

		This tool should be used to answer any question about Cloudflare products or features, including:
		- Workers, Pages, R2, Images, Stream, D1, Durable Objects, KV, Workflows, Hyperdrive, Queues
		- AI Search, Workers AI, Vectorize, AI Gateway, Browser Rendering
		- Zero Trust, Access, Tunnel, Gateway, Browser Isolation, WARP, DDOS, Magic Transit, Magic WAN
		- CDN, Cache, DNS, Zaraz, Argo, Rulesets, Terraform, Account and Billing

		Results are returned as semantically similar chunks to the query.
		`,
		{
			query: z.string(),
		},
		{
			title: 'Search Cloudflare docs',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ query }) => {
			const results = await queryVectorize(env.AI, env.VECTORIZE, query, TOP_K)
			const resultsAsXml = results
				.map((result) => {
					return `<result>
<url>${result.url}</url>
<title>${result.title}</title>
<text>
${result.text}
</text>
</result>`
				})
				.join('\n')
			return {
				content: [{ type: 'text', text: resultsAsXml }],
			}
		}
	)

	// Note: this is a tool instead of a prompt because
	// prompt support is much less common than tools.
	server.tool(
		'migrate_pages_to_workers_guide',
		`ALWAYS read this guide before migrating Pages projects to Workers.`,
		{},
		{
			title: 'Get Pages migration guide',
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const res = await fetch(
				'https://developers.cloudflare.com/workers/prompts/pages-to-workers.txt',
				{
					cf: { cacheEverything: true, cacheTtl: 3600 },
				}
			)

			if (!res.ok) {
				return {
					content: [{ type: 'text', text: 'Error: Failed to fetch guide. Please try again.' }],
				}
			}

			return {
				content: [
					{
						type: 'text',
						text: await res.text(),
					},
				],
			}
		}
	)
}

async function queryVectorize(ai: Ai, vectorizeIndex: VectorizeIndex, query: string, topK: number) {
	// Recommendation from: https://ai.google.dev/gemma/docs/embeddinggemma/model_card#prompt_instructions
	const [queryEmbedding] = await getEmbeddings(ai, ['task: search result | query: ' + query])

	const { matches } = await vectorizeIndex.query(queryEmbedding, {
		topK,
		returnMetadata: 'all',
		returnValues: false,
	})

	return matches.map((match, _i) => ({
		similarity: Math.min(match.score, 1),
		id: match.id,
		url: sourceToUrl(String(match.metadata?.filePath ?? '')),
		title: String(match.metadata?.title ?? ''),
		text: String(match.metadata?.text ?? ''),
	}))
}

const TOP_DIR = 'src/content/docs'
function sourceToUrl(path: string) {
	const prefix = `${TOP_DIR}/`
	return (
		'https://developers.cloudflare.com/' +
		(path.startsWith(prefix) ? path.slice(prefix.length) : path)
			.replace(/index\.mdx$/, '')
			.replace(/\.mdx$/, '')
	)
}

async function getEmbeddings(ai: Ai, strings: string[]): Promise<number[][]> {
	const response = await doWithRetries(() =>
		// @ts-expect-error embeddinggemma not in types yet
		ai.run('@cf/google/embeddinggemma-300m', {
			text: strings,
		})
	)

	// @ts-expect-error embeddinggemma not in types yet
	return response.data
}

/**
 * @template T
 * @param {() => Promise<T>} action
 */
async function doWithRetries<T>(action: () => Promise<T>) {
	const NUM_RETRIES = 10
	const INIT_RETRY_MS = 50
	for (let i = 0; i <= NUM_RETRIES; i++) {
		try {
			return await action()
		} catch (e) {
			// TODO: distinguish between user errors (4xx) and system errors (5xx)
			console.error(e)
			if (i === NUM_RETRIES) {
				throw e
			}
			// Exponential backoff with full jitter
			await scheduler.wait(Math.random() * INIT_RETRY_MS * Math.pow(2, i))
		}
	}
	// Should never reach here – last loop iteration should return
	throw new Error('An unknown error occurred')
}
