import { z } from 'zod'

import {
	LIBRARY_BY_INSTANCE,
	resolveLibraries,
	StackSearchQueryParam,
	toPublicLibrary,
} from '../types/stack.types'

import type { McpRegistrationContext } from '@repo/mcp-common/src/registration-context'
import type { AiSearchChunk, AiSearchNamespace } from '../stack-mcp.context'
import type { StackLibrary } from '../types/stack.types'

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
 * Registers the Developer Stack tools for one request. The stack is scoped to the
 * subset selected via the `?libs=` URL param (or the whole stack when unscoped),
 * read from the request URL so both `/mcp` and `/sse` honor it.
 */
export function registerStackTools<Env extends RequiredEnv>(context: McpRegistrationContext<Env>) {
	const env = context.env
	const libsParam = new URL(context.request.url).searchParams.get('libs')
	const allowed = resolveLibraries(libsParam)

	const allowedSlugs = allowed.map((l) => l.slug) as [string, ...string[]]
	const allowedIds = allowed.map((l) => l.instanceId)
	const bySlug = new Map(allowed.map((l) => [l.slug, l]))
	const names = allowed.map((l) => l.name).join(', ')

	context.registerTool(
		'list_libraries',
		{
			description: `List the libraries search_dev_stack has docs for (${names}), each with its slug, name, source, and description.

Use it to check coverage or to get a \`library\` slug for search_dev_stack. You do not need to call it first: searching without a \`library\` already covers the whole stack.`,
			inputSchema: z.object({}),
			outputSchema: z.object({
				libraries: z.array(
					z.object({
						slug: z.string(),
						name: z.string(),
						source: z.string(),
						description: z.string(),
					})
				),
			}),
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

	context.registerTool(
		'search_dev_stack',
		{
			description: `Search current documentation for the tools you build with (${names}) and get relevant excerpts with source links.

Whenever you are building or prototyping anything, start here: search to find the right tools for the job and their current usage, then build from what you find. Use even when you think you know the answer because your training data may not reflect recent changes. Prefer this over web search for library docs. Cite the source URLs. Omit \`library\` to search the whole stack, or set one slug to focus.`,
			inputSchema: z.object({
				query: StackSearchQueryParam,
				library: z
					.enum(allowedSlugs)
					.optional()
					.describe(
						'Optional. Restrict the search to a single library by its slug (from list_libraries). Omit to search the whole stack, which is usually best unless you already know the exact tool.'
					),
			}),
			outputSchema: z.object({
				results: z.array(
					z.object({
						url: z.string(),
						title: z.string(),
						text: z.string(),
						score: z.number(),
						library: z.string(),
					})
				),
			}),
			annotations: { title: 'Search developer-stack docs', readOnlyHint: true },
		},
		async ({ query, library }) => {
			try {
				const retrieval = { max_num_results: MAX_RESULTS }
				// Reranking is always on: it re-orders retrieved chunks for relevance.
				const reranking = { enabled: true }
				let results: Array<ReturnType<typeof toResult>>

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
