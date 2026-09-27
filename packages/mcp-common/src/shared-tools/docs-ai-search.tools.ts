import { z } from 'zod'

import type { McpRegistrationContext } from '../registration-context'

interface RequiredEnv {
	DOCS_AI_SEARCH: AiSearchInstance
}

type DocsSearchResult = {
	similarity: number
	url: string
	title: string
	text: string
}

type DocsSearchOutput = {
	results: DocsSearchResult[]
}

// Zod schema for AI Search response validation
const AiSearchResponseSchema = z.object({
	chunks: z.array(
		z.object({
			score: z.number(),
			text: z.string(),
			item: z.object({
				key: z.string(),
			}),
		})
	),
})

/**
 * Registers the docs search tool with one request-scoped server using AI Search.
 */
export function registerDocsTools<Env extends RequiredEnv>(context: McpRegistrationContext<Env>) {
	context.registerTool(
		'search_cloudflare_documentation',
		{
			description: `Search the Cloudflare documentation.

		This tool should be used to answer any question about Cloudflare products or features, including:
		- Workers, Pages, R2, Images, Stream, D1, Durable Objects, KV, Workflows, Hyperdrive, Queues
		- AI Search, Workers AI, Vectorize, AI Gateway, Browser Run
		- Zero Trust, Access, Tunnel, Gateway, Browser Isolation, WARP, DDOS, Magic Transit, Magic WAN
		- CDN, Cache, DNS, Zaraz, Argo, Rulesets, Terraform, Account and Billing

		Results are returned as semantically similar chunks to the query.
		`,
			inputSchema: z.object({
				query: z.string(),
			}),
			outputSchema: z.object({
				results: z.array(
					z.object({
						similarity: z.number().describe('Similarity score from AI Search'),
						url: z.string().describe('Developer documentation URL'),
						title: z.string().describe('Documentation page title'),
						text: z.string().describe('Matching documentation chunk text'),
					})
				),
			}),
			annotations: {
				title: 'Search Cloudflare docs',
				readOnlyHint: true,
			},
		},
		async ({ query }) => {
			const structuredContent: DocsSearchOutput = {
				results: await queryAiSearch(context.env.DOCS_AI_SEARCH, query),
			}
			return {
				content: [{ type: 'text', text: formatDocsResults(structuredContent.results) }],
				structuredContent,
			}
		}
	)

	// Note: this is a tool instead of a prompt because
	// prompt support is much less common than tools.
	context.registerTool(
		'migrate_pages_to_workers_guide',
		{
			description: `ALWAYS read this guide before migrating Pages projects to Workers.`,
			inputSchema: z.object({}),
			annotations: {
				title: 'Get Pages migration guide',
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

export async function queryAiSearch(
	instance: AiSearchInstance,
	query: string
): Promise<DocsSearchResult[]> {
	const rawResponse = await doWithRetries(() => instance.search({ query }))

	// Parse and validate the response using Zod
	const response = AiSearchResponseSchema.parse(rawResponse)

	return response.chunks.map((chunk) => ({
		similarity: chunk.score,
		url: sourceToUrl(chunk.item.key),
		title: extractTitle(chunk.item.key),
		text: chunk.text,
	}))
}

export function formatDocsResults(results: DocsSearchResult[]): string {
	return results
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
}

function sourceToUrl(filename: string): string {
	const path = filename.replace(/index\.mdx?$/, '').replace(/\.mdx?$/, '')
	return new URL(path, 'https://developers.cloudflare.com/').href
}

function extractTitle(filename: string): string {
	let source = filename
	try {
		source = new URL(filename).pathname
	} catch {
		// Relative source path.
	}
	const parts = source
		.replace(/\/+$/, '')
		.replace(/\.mdx?$/, '')
		.split('/')
		.filter(Boolean)
	const lastPart = parts.at(-1)
	if (lastPart === 'index') return parts.at(-2) || 'Documentation'
	if (!lastPart) return 'Documentation'
	return lastPart.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * Retries an action with exponential backoff, only for retryable errors
 * @template T
 * @param {() => Promise<T>} action
 */
async function doWithRetries<T>(action: () => Promise<T>) {
	const NUM_RETRIES = 5
	const INIT_RETRY_MS = 100

	for (let i = 0; i <= NUM_RETRIES; i++) {
		try {
			return await action()
		} catch (e) {
			// Check if error is retryable (system errors, not user errors)
			const isRetryable = isRetryableError(e)

			console.error(`AI Search attempt ${i + 1} failed:`, e)

			if (!isRetryable || i === NUM_RETRIES) {
				throw e
			}

			// Exponential backoff with jitter
			const delay = Math.random() * INIT_RETRY_MS * Math.pow(2, i)
			await scheduler.wait(delay)
		}
	}
	// Should never reach here – last loop iteration should throw
	throw new Error('An unknown error occurred')
}

/**
 * Determines if an error is retryable based on error type and status
 */
function isRetryableError(error: unknown): boolean {
	// Handle HTTP errors from fetch-like responses
	if (error && typeof error === 'object' && 'status' in error) {
		const status = (error as { status: number }).status
		// Retry server errors (5xx) and rate limits (429), not client errors (4xx)
		return status >= 500 || status === 429
	}

	// Handle network errors, timeouts, etc.
	if (error instanceof Error) {
		const errorMessage = error.message.toLowerCase()
		return (
			errorMessage.includes('timeout') ||
			errorMessage.includes('network') ||
			errorMessage.includes('connection') ||
			errorMessage.includes('fetch')
		)
	}

	// Default to retryable for unknown errors (conservative approach)
	return true
}
