import { z } from 'zod'

import {
	LIBRARY_BY_INSTANCE,
	StackSearchQueryParam,
	toPublicLibrary,
	type StackLibrary,
} from '../types/stack.types'

import type { AiSearchChunk, AiSearchNamespace } from '../stack-mcp.context'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const MAX_RESULTS = 10

interface RequiredEnv {
	AI_SEARCH: AiSearchNamespace
}

function formatError(message: string) {
	return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function toResult(chunk: AiSearchChunk, fallback?: StackLibrary) {
	const lib = chunk.instance_id ? LIBRARY_BY_INSTANCE.get(chunk.instance_id) : fallback
	const title =
		typeof chunk.item.metadata?.title === 'string' ? chunk.item.metadata.title : chunk.item.key
	return {
		url: chunk.item.key,
		title,
		text: chunk.text,
		score: chunk.score,
		library: lib?.name ?? 'docs',
	}
}

/**
 * Registers the Developer Stack tools, scoped to `allowed` (the subset selected
 * via the `?libs=` URL param, or the whole stack when unscoped).
 */
export function registerStackTools(server: McpServer, env: RequiredEnv, allowed: StackLibrary[]) {
	const allowedSlugs = allowed.map((l) => l.slug) as [string, ...string[]]
	const allowedIds = allowed.map((l) => l.instanceId)
	const bySlug = new Map(allowed.map((l) => [l.slug, l]))
	const names = allowed.map((l) => l.name).join(', ')

	server.registerTool(
		'list_libraries',
		{
			description: `List the tools whose documentation this server can search (${names}), with each one's slug, name, source site, and a short description.

Use it to check whether a tool is covered, or to get the exact \`library\` slug for search_docs. You do not need to call it first: searching without a \`library\` already covers the whole stack.`,
			inputSchema: {},
			outputSchema: {
				libraries: z.array(
					z.object({
						slug: z.string(),
						name: z.string(),
						source: z.string(),
						description: z.string(),
					})
				),
			},
			annotations: { title: 'List developer-stack libraries', readOnlyHint: true },
		},
		async () => {
			const libraries = allowed.map(toPublicLibrary)
			return {
				structuredContent: { libraries },
				content: [
					{
						type: 'text' as const,
						text: allowed
							.map((l) => `- ${l.slug}: ${l.name} (${l.source}). ${l.description}`)
							.join('\n'),
					},
				],
			}
		}
	)

	server.registerTool(
		'search_docs',
		{
			description: `Search current documentation for the tools in this developer stack (${names}) and get back the most relevant excerpts, each with a source link.

Reach for this whenever you are answering a question about, or writing code that uses, any of these tools. They change often, so your built-in knowledge of their APIs, configuration, and defaults is frequently out of date. Retrieve the docs instead of relying on memory, and ground the code you generate in what you find.

Cite the returned source URLs in your answer. Searches the whole stack by default; set \`library\` to one slug (from list_libraries) to focus on a single tool.`,
			inputSchema: {
				query: StackSearchQueryParam,
				library: z
					.enum(allowedSlugs)
					.optional()
					.describe(
						'Optional. Restrict the search to a single library by its slug (from list_libraries). Omit to search the whole stack, which is usually best unless you already know the exact tool.'
					),
			},
			outputSchema: {
				results: z.array(
					z.object({
						url: z.string(),
						title: z.string(),
						text: z.string(),
						score: z.number(),
						library: z.string(),
					})
				),
			},
			annotations: { title: 'Search developer-stack docs', readOnlyHint: true },
		},
		async ({ query, library }) => {
			try {
				const retrieval = { max_num_results: MAX_RESULTS }
				// Reranking is always on: it re-orders retrieved chunks for relevance.
				const reranking = { enabled: true }
				let results: ReturnType<typeof toResult>[]

				if (library) {
					const lib = bySlug.get(library)
					if (!lib) return formatError(`Unknown library: ${library}`)
					const res = await env.AI_SEARCH.get(lib.instanceId).search({
						query,
						ai_search_options: { retrieval, reranking },
					})
					results = res.chunks.map((c) => toResult(c, lib))
				} else {
					const res = await env.AI_SEARCH.search({
						query,
						ai_search_options: { instance_ids: allowedIds, retrieval, reranking },
					})
					results = res.chunks.map((c) => toResult(c))
				}

				const text =
					results.length === 0
						? 'No relevant documentation found.'
						: results
								.map(
									(r) =>
										`<result>\n<library>${r.library}</library>\n<url>${r.url}</url>\n<title>${r.title}</title>\n<text>\n${r.text}\n</text>\n</result>`
								)
								.join('\n')

				return { structuredContent: { results }, content: [{ type: 'text' as const, text }] }
			} catch (e) {
				return formatError(e instanceof Error ? e.message : String(e))
			}
		}
	)
}
