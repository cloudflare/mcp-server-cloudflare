import { z } from 'zod'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RequiredEnv {
	AI: Ai
}

// Zod schema for AI Search response validation
const AiSearchResponseSchema = z.object({
	object: z.string(),
	search_query: z.string(),
	data: z.array(z.object({
		file_id: z.string(),
		filename: z.string(),
		score: z.number(),
		attributes: z.object({
			modified_date: z.number().optional(),
			folder: z.string().optional(),
		}).catchall(z.any()),
		content: z.array(z.object({
			id: z.string(),
			type: z.string(),
			text: z.string(),
		})),
	})),
	has_more: z.boolean(),
	next_page: z.string().nullable(),
})


/**
 * Registers the docs search tool with the MCP server using AI Search
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
			const results = await queryAiSearch(env.AI, query)
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

async function queryAiSearch(ai: Ai, query: string) {
	const rawResponse = await doWithRetries(() =>
		ai.autorag("docs-mcp-rag").search({
			query,
		})
	)

	// Parse and validate the response using Zod
	const response = AiSearchResponseSchema.parse(rawResponse)

	return response.data.map((item) => ({
		similarity: item.score,
		id: item.file_id,
		url: sourceToUrl(item.filename),
		title: extractTitle(item.filename),
		text: item.content.map(c => c.text).join('\n'),
	}))
}

function sourceToUrl(filename: string): string {
	// Convert filename to URL format
	// Example: "workers/configuration/index.md" -> "https://developers.cloudflare.com/workers/configuration/"
	return (
		'https://developers.cloudflare.com/' +
		filename
			.replace(/index\.mdx?$/, '')
			.replace(/\.mdx?$/, '')
	)
}

function extractTitle(filename: string): string {
	// Extract a reasonable title from the filename
	// Example: "workers/configuration/index.md" -> "Configuration"
	const parts = filename.replace(/\.mdx?$/, '').split('/')
	const lastPart = parts[parts.length - 1]
	
	if (lastPart === 'index') {
		// Use the parent directory name if filename is index
		return parts[parts.length - 2] || 'Documentation'
	}
	
	// Convert kebab-case or snake_case to title case
	return lastPart
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, l => l.toUpperCase())
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