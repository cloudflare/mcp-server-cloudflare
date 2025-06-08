import { type EmbeddedResource } from '@modelcontextprotocol/sdk/types.js'
import mime from 'mime'
import { z } from 'zod'

import type { CloudflareDocumentationMCP } from '../docs-autorag.app'

/**
 * Registers the docs search tool with the MCP server
 * @param agent The MCP server instance
 */
export function registerDocsTools(agent: CloudflareDocumentationMCP) {
	// Register the worker logs analysis tool by worker name
	agent.server.tool(
		'search_cloudflare_documentation',
		`Search the Cloudflare documentation.

		You should use this tool when:
		- A user asks questions about Cloudflare products (Workers, Developer Platform, Zero Trust, CDN, etc)
		- A user requests information about a Cloudflare feature
		- You are unsure of how to use some Cloudflare functionality
		- You are writing Cloudflare Workers code and need to look up Workers-specific documentation

		This tool returns a number of results from a vector database. These are embedded as resources in the response and are plaintext documents in a variety of formats.
		`,
		{
			// partially pulled from autorag query optimization example
			query: z.string().describe(`Search query. The query should:
1. Identify the core concepts and intent
2. Add relevant synonyms and related terms
3. Remove irrelevant filler words
4. Structure the query to emphasize key terms
5. Include technical or domain-specific terminology if applicable`),
			scoreThreshold: z
				.number()
				.min(0)
				.max(1)
				.optional()
				.describe('A score threshold (0-1) for which matches should be included.'),
			maxNumResults: z
				.number()
				.default(10)
				.optional()
				.describe('The maximum number of results to return.'),
		},
		async (params) => {
			// we don't need "rewrite query" OR aiSearch because an LLM writes the query and formats the output for us.
			const result = await agent.env.AI.autorag(agent.env.AUTORAG_NAME).search({
				query: params.query,
				ranking_options: params.scoreThreshold
					? {
							score_threshold: params.scoreThreshold,
						}
					: undefined,
				max_num_results: params.maxNumResults,
			})

			const resources: EmbeddedResource[] = result.data.map((result) => {
				const content = result.content.reduce((acc, contentPart) => {
					return acc + contentPart.text
				}, '')
				return {
					type: 'resource',
					resource: {
						uri: `docs://${result.filename}`,
						mimeType: mime.getType(result.filename) ?? 'text/plain',
						text: content,
					},
				}
			})

			return {
				content: resources,
			}
		}
	)
}
