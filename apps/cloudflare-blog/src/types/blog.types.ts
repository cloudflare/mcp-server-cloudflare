import { z } from 'zod'

// ---- Tool name constants ---------------------------------------------------

export const BLOG_TOOLS = {
	search_posts: 'search_posts',
	list_posts: 'list_posts',
	get_post: 'get_post',
	list_tags: 'list_tags',
} as const

// ---- search_posts ----------------------------------------------------------

export const BlogSearchQueryParam = z.string().describe('The search query')

// ---- list_posts ------------------------------------------------------------

export const BlogListLimitParam = z
	.number()
	.int()
	.min(1)
	.max(50)
	.optional()
	.describe('Number of posts to return (1–50, default 20)')

export const BlogListCursorParam = z
	.string()
	.optional()
	.describe('Pagination cursor from a previous list_posts response')

export const BlogListTagParam = z
	.string()
	.optional()
	.describe('Filter by tag slug, e.g. "workers" or "zero-trust"')

// ---- get_post --------------------------------------------------------------

export const BlogPostSlugParam = z.string().describe('The post slug, e.g. "workers-python-support"')
