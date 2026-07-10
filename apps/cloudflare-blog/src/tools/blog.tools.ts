import { z } from 'zod'

import {
	BlogListCursorParam,
	BlogListLimitParam,
	BlogListTagParam,
	BlogPostSlugParam,
	BlogSearchQueryParam,
} from '../types/blog.types'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RequiredEnv {
	BLOG_BASE_URL: string
	SEARCH_BASE_URL: string
}

// ---- shared helpers --------------------------------------------------------

function formatError(message: string) {
	return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
	return res.json() as Promise<T>
}

// ---- tool registrations ----------------------------------------------------

export function registerBlogTools(server: McpServer, env: RequiredEnv) {
	const blogBase = env.BLOG_BASE_URL.replace(/\/$/, '')
	const searchBase = env.SEARCH_BASE_URL.replace(/\/$/, '')

	// ---- search_posts -------------------------------------------------------

	server.registerTool(
		'search_posts',
		{
			description: `Search the Cloudflare Blog using semantic search.

Use this tool to find blog posts about any Cloudflare topic, product, or technology.
Returns the most relevant posts with excerpts and URLs.

Examples of good queries:
- "Workers KV storage limits"
- "DDoS protection announcements 2024"
- "how Cloudflare uses Rust"`,
			inputSchema: {
				query: BlogSearchQueryParam,
			},
			outputSchema: {
				results: z.array(
					z.object({
						url: z.string().describe('URL to the full blog post'),
						title: z.string().describe('Post title'),
						excerpt: z.string().describe('Relevant excerpt from the post'),
						score: z.number().describe('Relevance score'),
					})
				),
			},
			annotations: { title: 'Search Cloudflare Blog', readOnlyHint: true },
		},
		async ({ query }) => {
			try {
				const res = await fetch(`${searchBase}/search`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query }),
				})

				if (!res.ok) return formatError(`Search failed: HTTP ${res.status}`)

				const data = (await res.json()) as {
					success: boolean
					result?: {
						chunks?: Array<{
							item?: { key?: string; metadata?: { title?: string; description?: string } }
							score?: number
							text?: string
						}>
					}
				}

				if (!data.success || !data.result?.chunks) return formatError('No results returned')

				// Deduplicate by URL, keep highest-scoring chunk per post
				const seen = new Map<
					string,
					{ url: string; title: string; excerpt: string; score: number }
				>()
				for (const chunk of data.result.chunks) {
					const url = chunk.item?.key ?? ''
					if (!url) continue
					const score = chunk.score ?? 0
					if (!seen.has(url) || score > seen.get(url)!.score) {
						seen.set(url, {
							url,
							title: chunk.item?.metadata?.title ?? '',
							excerpt: chunk.item?.metadata?.description ?? chunk.text?.slice(0, 300) ?? '',
							score,
						})
					}
				}

				const results = [...seen.values()].sort((a, b) => b.score - a.score)
				const structuredContent = { results }

				return {
					structuredContent,
					content: [
						{
							type: 'text' as const,
							text: results
								.map(
									(r) =>
										`<result>\n<url>${r.url}</url>\n<title>${r.title}</title>\n<excerpt>${r.excerpt}</excerpt>\n</result>`
								)
								.join('\n'),
						},
					],
				}
			} catch (e) {
				return formatError(e instanceof Error ? e.message : String(e))
			}
		}
	)

	// ---- list_posts ---------------------------------------------------------

	server.registerTool(
		'list_posts',
		{
			description: `List Cloudflare Blog posts in reverse chronological order.

Optionally filter by tag. Use the returned nextCursor to paginate through results.`,
			inputSchema: {
				limit: BlogListLimitParam,
				cursor: BlogListCursorParam,
				tag: BlogListTagParam,
			},
			outputSchema: {
				posts: z.array(
					z.object({
						slug: z.string(),
						title: z.string(),
						excerpt: z.string(),
						publishedAt: z.string().nullable(),
						url: z.string(),
						tags: z.array(z.string()),
						authors: z.array(z.string()),
					})
				),
				nextCursor: z.string().nullable(),
			},
			annotations: { title: 'List blog posts', readOnlyHint: true },
		},
		async ({ limit, cursor, tag }) => {
			try {
				const params = new URLSearchParams()
				if (limit) params.set('limit', String(limit))
				if (cursor) params.set('cursor', cursor)
				if (tag) params.set('tag', tag)

				const qs = params.toString()
				const url = `${blogBase}/api/mcp/posts${qs ? `?${qs}` : ''}`
				const data = await fetchJson<{ posts: unknown[]; nextCursor: string | null }>(url)

				return {
					structuredContent: data,
					content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				}
			} catch (e) {
				return formatError(e instanceof Error ? e.message : String(e))
			}
		}
	)

	// ---- get_post -----------------------------------------------------------

	server.registerTool(
		'get_post',
		{
			description: `Get a single Cloudflare Blog post by slug, including its full HTML content.

Use the slug from a list_posts or search_posts result.`,
			inputSchema: {
				slug: BlogPostSlugParam,
			},
			outputSchema: {
				slug: z.string(),
				title: z.string(),
				excerpt: z.string(),
				publishedAt: z.string().nullable(),
				url: z.string(),
				tags: z.array(z.string()),
				authors: z.array(z.string()),
				content: z.string().describe('Full post content as HTML'),
			},
			annotations: { title: 'Get blog post', readOnlyHint: true },
		},
		async ({ slug }) => {
			try {
				const data = await fetchJson<Record<string, unknown>>(
					`${blogBase}/api/mcp/posts/${encodeURIComponent(slug)}`
				)
				return {
					structuredContent: data,
					content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				}
			} catch (e) {
				return formatError(e instanceof Error ? e.message : String(e))
			}
		}
	)

	// ---- list_tags ----------------------------------------------------------

	server.registerTool(
		'list_tags',
		{
			description: `List all tags used on the Cloudflare Blog.

Use the returned slugs to filter list_posts by topic, e.g. "workers", "zero-trust", "radar".`,
			inputSchema: {},
			outputSchema: {
				tags: z.array(
					z.object({
						slug: z.string(),
						label: z.string(),
					})
				),
			},
			annotations: { title: 'List blog tags', readOnlyHint: true },
		},
		async () => {
			try {
				const data = await fetchJson<{ tags: Array<{ slug: string; label: string }> }>(
					`${blogBase}/api/mcp/tags`
				)
				return {
					structuredContent: data,
					content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				}
			} catch (e) {
				return formatError(e instanceof Error ? e.message : String(e))
			}
		}
	)
}
