import { z } from 'zod'

import { getProps } from '@repo/mcp-common/src/get-props'

import { WORKERS_AI_MODEL_ID_PATTERN } from './ai/runner'
import { loadConfig, saveConfig } from './config'
import { contentHash } from './content-hash'
import {
	expandConversation,
	getConversationStats,
	indexSessions,
	isOpenCodeSession,
	isSafeSessionId,
	loadConversationIndex,
	parseOpenCodeSession,
} from './conversations'
import { errResult, isToolResult, okResult } from './helpers'
import { runReflection } from './reflection'
import {
	archiveReflection,
	listPendingReflections,
	readStagedReflectionData,
} from './reflection/staging'
import { checkReminders, listReminders, removeReminder, scheduleReminder } from './reminders'
import { EmptyContentError, indexWrite } from './search/index-write'
import { isManagedMemoryPath, isSecretMemoryPath } from './storage/r2'
import { parseTags } from './tags'
import { extractSnippet, truncateWithMeta } from './truncate'
import { buildUserContext } from './user-context'
import { parseWikilinks } from './wikilinks'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ZodRawShape } from 'zod'
import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import type { Env } from './agent-memory.context'
import type { ToolResult } from './helpers'
import type { ProposedEdit } from './reflection/tool-executor'
import type { UserContext } from './user-context'

const MAX_FILE_CONTENT_LENGTH = 1_000_000
const MAX_BATCH_CONTENT_LENGTH = 5_000_000
const MAX_CONVERSATION_PAYLOAD_LENGTH = 2_000_000
const MAX_CONVERSATION_EXCHANGES = 50
const CONVERSATION_INDEX_CONCURRENCY = 5
const MAX_SEARCH_RESULTS = 50

const StoragePath = z
	.string()
	.min(1)
	.max(1024)
	.refine(
		(path) =>
			!path.startsWith('/') &&
			!path.endsWith('/') &&
			!path.includes('\\') &&
			!path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..'),
		{ message: 'Use a relative memory path without empty, ".", or ".." segments' }
	)
const ReadablePath = StoragePath.refine(
	(path) => !isSecretMemoryPath(path),
	'Path is managed by a dedicated Agent Memory tool'
)
const WritablePath = StoragePath.refine(
	(path) => !isManagedMemoryPath(path),
	'Path is reserved for Agent Memory internal state'
)
const DirectoryPath = z
	.string()
	.max(1024)
	.refine((path) => {
		if (path.startsWith('/')) return false
		const normalized = path.endsWith('/') ? path.slice(0, -1) : path
		return (
			normalized === '' ||
			(!normalized.startsWith('/') &&
				!normalized.includes('\\') &&
				!normalized
					.split('/')
					.some((segment) => segment === '' || segment === '.' || segment === '..'))
		)
	}, 'Use a relative directory path without empty, ".", or ".." segments')
	.refine(
		(path) => !isSecretMemoryPath(path.replace(/\/$/, '')),
		'Path is managed by a dedicated Agent Memory tool'
	)
const Tag = z.string().trim().min(1).max(128)
const Tags = z.array(Tag).max(20)
const SearchLimit = z.number().int().min(1).max(MAX_SEARCH_RESULTS)
const ReflectionDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const ModelId = z
	.string()
	.min(1)
	.max(256)
	.regex(WORKERS_AI_MODEL_ID_PATTERN, 'Expected a Workers AI model ID like @cf/provider/model')

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = []
	for (let offset = 0; offset < items.length; offset += concurrency) {
		results.push(...(await Promise.all(items.slice(offset, offset + concurrency).map(mapper))))
	}
	return results
}

/**
 * Structural view of the McpAgent the tools need. Kept minimal so the tool
 * registration doesn't depend on the concrete agent class (avoids an import
 * cycle with `agent-memory.app.ts`).
 */
export interface MemoryAgent {
	server: CloudflareMCPServer
	props?: AuthProps
}

type Handler<Shape extends ZodRawShape> = (
	args: z.infer<z.ZodObject<Shape>>,
	userCtx: UserContext
) => Promise<ToolResult | Record<string, unknown> | string>

/**
 * Register an account-scoped memory tool.
 *
 * Wraps `server.accountTool` so the handler receives a fully-built
 * {@link UserContext} (account-scoped R2 storage, Workers AI, and search
 * index) instead of a raw account id, and so every handler shares the
 * same success/error shaping.
 */
function memoryTool<Shape extends ZodRawShape>(
	agent: MemoryAgent,
	env: Env,
	name: string,
	description: string,
	shape: Shape,
	handler: Handler<Shape>
): void {
	agent.server.accountTool(
		name,
		description,
		shape,
		async (args, accountId): Promise<CallToolResult> => {
			try {
				const props = getProps(agent)
				const userCtx = buildUserContext(env, props, accountId)
				const result = await handler(args as z.infer<z.ZodObject<Shape>>, userCtx)
				if (typeof result === 'string') {
					return { content: [{ type: 'text', text: result }] }
				}
				if (isToolResult(result)) {
					return result as CallToolResult
				}
				return okResult(result) as CallToolResult
			} catch (e) {
				return errResult(`${name} failed`, e) as CallToolResult
			}
		}
	)
}

export function registerMemoryTools(agent: MemoryAgent, env: Env): void {
	const tool = <Shape extends ZodRawShape>(
		name: string,
		description: string,
		shape: Shape,
		handler: Handler<Shape>
	) => memoryTool(agent, env, name, description, shape, handler)
	// ==================== Core Memory Tools ====================

	tool(
		'read',
		'Read one file or up to 50 files from memory storage.',
		{
			path: z
				.union([ReadablePath, z.array(ReadablePath).min(1).max(50)])
				.describe("File path or array of paths, e.g., 'memory/learnings.md'"),
		},
		async ({ path }, { storage }) => {
			if (Array.isArray(path)) {
				const files: Array<readonly [string, Record<string, unknown>]> = []
				// Read sequentially so a valid 50-file request cannot buffer 50 large
				// R2 objects in the Worker at once.
				for (const filePath of path) {
					const file = await storage.read(filePath)
					if (!file) {
						files.push([filePath, { error: 'File not found' }])
						continue
					}
					const truncated = truncateWithMeta(file.content)
					const entry: Record<string, unknown> = {
						content: truncated.content,
						updated_at: file.updated_at,
						size: file.size,
					}
					if (truncated.truncated) {
						entry.truncated = true
						entry.original_size = file.size
					}
					files.push([filePath, entry])
				}
				const found = files.filter(([, v]) => !('error' in v)).length
				return okResult({ files: Object.fromEntries(files) }, `Read ${found}/${path.length} files`)
			}

			const file = await storage.read(path)
			if (!file) {
				return errResult('File not found', { path })
			}
			const t = truncateWithMeta(file.content)
			const body: Record<string, unknown> = {
				content: t.content,
				updated_at: file.updated_at,
				size: file.size,
			}
			if (t.truncated) {
				body.truncated = true
				body.original_size = file.size
			}
			const prefix = t.truncated
				? `Read ${path} (${file.size} bytes, content truncated to ${t.content.length} characters)`
				: `Read ${path} (${file.size} bytes)`
			return okResult(body, prefix)
		}
	)

	tool(
		'write',
		'Write content to a file. Automatically updates the search index, extracts tags from YAML frontmatter, and indexes Obsidian-style [[wikilinks]]. Returns semantic overlap warnings for memory/ paths by default.\n\nPass `detect_overlaps: false` to skip the post-write similarity search.\n\nEmpty content is refused by default — pass `allow_empty: true` to truncate a file deliberately.',
		{
			path: WritablePath.describe("File path, e.g., 'memory/learnings.md'"),
			content: z.string().max(MAX_FILE_CONTENT_LENGTH).describe('Content to write'),
			detect_overlaps: z
				.boolean()
				.optional()
				.default(true)
				.describe('Run a similarity search after the write and surface duplicate memory/ files.'),
			allow_empty: z
				.boolean()
				.optional()
				.default(false)
				.describe('Permit writing zero-byte content (destructive truncate).'),
		},
		async ({ path, content, detect_overlaps, allow_empty }, userCtx) => {
			try {
				const result = await indexWrite(userCtx.index, userCtx.storage, path, content, {
					detectOverlaps: detect_overlaps,
					allowEmpty: allow_empty,
				})
				if (result.embedding_error) {
					return errResult('File was stored, but search indexing failed', {
						path,
						stored: true,
						index_error: result.embedding_error,
						hint: 'Call reindex for this path to retry indexing.',
					})
				}
				return okResult(result, `Wrote ${path}`)
			} catch (e) {
				if (e instanceof EmptyContentError) {
					return errResult(e.message, { path })
				}
				throw e
			}
		}
	)

	tool(
		'write_many',
		'Write multiple files in one call. Each entry is processed independently. Max 50 files. detect_overlaps defaults OFF for bulk writes.',
		{
			files: z
				.array(
					z.object({
						path: WritablePath,
						content: z.string().max(MAX_FILE_CONTENT_LENGTH),
						detect_overlaps: z.boolean().optional(),
						allow_empty: z.boolean().optional(),
					})
				)
				.min(1)
				.max(50)
				.refine(
					(files) => new Set(files.map((file) => file.path)).size === files.length,
					'File paths must be unique within a batch'
				)
				.refine(
					(files) =>
						files.reduce((total, file) => total + file.content.length, 0) <=
						MAX_BATCH_CONTENT_LENGTH,
					`Combined content must not exceed ${MAX_BATCH_CONTENT_LENGTH} characters`
				)
				.describe('Up to 50 files to write.'),
		},
		async ({ files }, userCtx) => {
			const results = await mapWithConcurrency(files, 5, async (file) => {
				try {
					const result = await indexWrite(userCtx.index, userCtx.storage, file.path, file.content, {
						detectOverlaps: file.detect_overlaps ?? false,
						allowEmpty: file.allow_empty ?? false,
					})
					return {
						...result,
						path: file.path,
						stored: true,
						success: !result.embedding_error,
						error: result.embedding_error,
					}
				} catch (error) {
					return {
						path: file.path,
						success: false,
						error: error instanceof Error ? error.message : String(error),
					}
				}
			})
			const ok = results.filter((r) => r.success).length
			return okResult({ results }, `Wrote ${ok}/${files.length} files`)
		}
	)

	tool(
		'reindex',
		'Rebuild search, tag, and backlink entries for one file or up to 50 files already stored in R2. Use this after a write reports an indexing error.',
		{
			path: z
				.union([
					WritablePath,
					z
						.array(WritablePath)
						.min(1)
						.max(50)
						.refine(
							(paths) => new Set(paths).size === paths.length,
							'Paths must be unique within a reindex batch'
						),
				])
				.describe('Stored file path or array of paths to reindex'),
		},
		async ({ path }, { storage, index }) => {
			const paths = Array.isArray(path) ? path : [path]
			const results = await mapWithConcurrency(paths, 5, async (filePath) => {
				try {
					const file = await storage.read(filePath)
					if (!file || file.content.length === 0) {
						await index.delete(filePath)
						return {
							path: filePath,
							success: Boolean(file),
							indexed: false,
							message: file
								? 'Empty file removed from index'
								: 'File not found; stale index removed',
						}
					}
					await index.update({
						path: filePath,
						content: file.content,
						tags: parseTags(file.content),
						links: parseWikilinks(file.content),
					})
					return { path: filePath, success: true, indexed: true }
				} catch (error) {
					return {
						path: filePath,
						success: false,
						indexed: false,
						error: error instanceof Error ? error.message : String(error),
					}
				}
			})
			const succeeded = results.filter((result) => result.success).length
			return okResult({ results }, `Reindexed ${succeeded}/${paths.length} files`)
		}
	)

	tool(
		'list',
		'List files in a directory. Pass `tags` to restrict to files matching every tag (intersection).',
		{
			path: DirectoryPath.optional().describe('Directory path, defaults to root'),
			recursive: z.boolean().optional().default(false).describe('List recursively'),
			tags: Tags.optional().describe('If provided, only return files tagged with all of these'),
		},
		async ({ path, recursive, tags }, { storage, index }) => {
			const files = (await storage.list(path, recursive)).filter(
				(file) => !isSecretMemoryPath(file.path.replace(/\/$/, ''))
			)
			if (!tags || tags.length === 0) {
				return { files }
			}
			const { paths } = await index.filesWithTags(tags)
			const allowed = new Set(paths)
			return { files: files.filter((file) => allowed.has(file.path)), filtered_by_tags: tags }
		}
	)

	tool(
		'list_tags',
		'List all tags currently indexed, with the number of files carrying each. Sorted by count desc.',
		{},
		async (_args, { index }) => index.tags()
	)

	tool(
		'search',
		"Search memory by meaning. Returns relevant file snippets. Pass `tags` to restrict to files matching every tag. Pass `scope: 'conversations'` to search indexed chat exchanges instead of memory files, or `scope: 'all'` for both.",
		{
			query: z.string().trim().min(1).max(8_000).describe('Natural language query'),
			limit: SearchLimit.optional().default(5).describe('Max results to return'),
			tags: Tags.optional().describe('If provided, only match files tagged with all of these'),
			scope: z
				.enum(['memory', 'conversations', 'all'])
				.optional()
				.default('memory')
				.describe('What to search. Defaults to memory files only.'),
		},
		async ({ query, limit, tags, scope }, { storage, index }) => {
			const effectiveLimit = limit ?? 5
			const searchScope = scope ?? 'memory'
			const rawResults = await index.search({
				query,
				limit: effectiveLimit,
				tags,
				scope: searchScope,
				timeWeight: searchScope !== 'memory',
			})

			const memoryHits =
				searchScope === 'conversations'
					? []
					: rawResults.filter((r) => !r.id.startsWith('conversations/exchanges/'))
			const conversationHits =
				searchScope === 'memory'
					? []
					: rawResults.filter((r) => r.id.startsWith('conversations/exchanges/'))

			const enrichedMemory: Array<{ path: string; snippet: string; score: number }> = []
			for (const result of memoryHits.slice(0, effectiveLimit)) {
				const file = await storage.read(result.id)
				enrichedMemory.push({
					path: result.id,
					snippet: file ? extractSnippet(file.content) : '',
					score: result.score,
				})
			}

			let enrichedConversations: Array<Record<string, unknown>> = []
			if (conversationHits.length > 0) {
				const conversationIndex = await loadConversationIndex(storage)
				enrichedConversations = conversationHits.slice(0, effectiveLimit).map((r) => {
					const exchangeId = r.id.replace('conversations/exchanges/', '').replace('.txt', '')
					const exchange = conversationIndex.exchanges.find((e) => e.id === exchangeId)
					return {
						id: exchangeId,
						score: r.score,
						project: exchange?.project,
						userPrompt: exchange?.userPrompt?.slice(0, 200),
						timestamp: exchange?.timestamp,
						sessionId: exchange?.sessionId,
					}
				})
			}

			if (searchScope === 'memory') {
				return okResult(
					{ results: enrichedMemory },
					`Found ${enrichedMemory.length} match${enrichedMemory.length === 1 ? '' : 'es'} for "${query}"`
				)
			}
			if (searchScope === 'conversations') {
				return okResult(
					{
						results: enrichedConversations,
						hint: 'Use expand_conversation with sessionId to see full context',
					},
					`Found ${enrichedConversations.length} conversation match${enrichedConversations.length === 1 ? '' : 'es'} for "${query}"`
				)
			}
			return okResult(
				{
					memory: enrichedMemory,
					conversations: enrichedConversations,
					hint: 'Use expand_conversation with sessionId to see full conversation context',
				},
				`Found ${enrichedMemory.length} memory + ${enrichedConversations.length} conversation match${enrichedMemory.length + enrichedConversations.length === 1 ? '' : 'es'} for "${query}"`
			)
		}
	)

	tool(
		'get_backlinks',
		'List files that link to the given target via Obsidian-style wikilinks ([[target]]).',
		{
			target: z
				.string()
				.trim()
				.min(1)
				.max(1024)
				.describe("Wikilink target as written inside [[...]], e.g. 'memory/learnings'"),
		},
		async ({ target }, { index }) => {
			const { backlinks } = await index.backlinks(target)
			return { target, backlinks }
		}
	)

	// ==================== Conversation Tools ====================

	tool(
		'search_conversations',
		"Search past conversations by meaning. Prefer `search({ scope: 'conversations' })` in new code.",
		{
			query: z
				.string()
				.trim()
				.min(1)
				.max(8_000)
				.describe("What to search for, e.g., 'TypeScript errors', 'API design'"),
			limit: SearchLimit.optional().default(5).describe('Max results to return'),
		},
		async ({ query, limit }, { storage, index }) => {
			const conversationIndex = await loadConversationIndex(storage)
			if (conversationIndex.exchanges.length === 0) {
				return {
					results: [],
					message: 'No conversations indexed yet. Use index_conversations to sync.',
				}
			}
			const effectiveLimit = limit ?? 5
			const rawResults = await index.search({
				query,
				limit: effectiveLimit,
				timeWeight: true,
				scope: 'conversations',
			})
			const results = rawResults.slice(0, effectiveLimit).map((r) => {
				const exchangeId = r.id.replace('conversations/exchanges/', '').replace('.txt', '')
				const exchange = conversationIndex.exchanges.find((e) => e.id === exchangeId)
				return {
					id: exchangeId,
					score: r.score,
					project: exchange?.project,
					userPrompt: exchange?.userPrompt?.slice(0, 200),
					timestamp: exchange?.timestamp,
					sessionId: exchange?.sessionId,
				}
			})
			return { results, hint: 'Use expand_conversation with sessionId to see full context' }
		}
	)

	tool(
		'index_conversations',
		'Index conversation sessions from a sync script. Called by client-side scripts, not directly.',
		{
			sessions: z
				.array(
					z.object({
						sessionId: z.string().refine(isSafeSessionId, 'Invalid session ID'),
						project: z.string().trim().min(1).max(256),
						data: z
							.record(z.string(), z.unknown())
							.refine(isOpenCodeSession, 'Expected a supported OpenCode session shape'),
					})
				)
				.min(1)
				.max(20)
				.refine(
					(sessions) =>
						new Set(sessions.map((session) => session.sessionId)).size === sessions.length,
					'Session IDs must be unique within a batch'
				)
				.refine(
					(sessions) => JSON.stringify(sessions).length <= MAX_CONVERSATION_PAYLOAD_LENGTH,
					`Conversation payload must not exceed ${MAX_CONVERSATION_PAYLOAD_LENGTH} characters`
				)
				.describe('Array of session objects to index'),
		},
		async ({ sessions }, { storage, index }) => {
			const typedSessions = sessions.map((session) => ({
				sessionId: session.sessionId,
				project: session.project,
				data: session.data as unknown as Parameters<typeof indexSessions>[1][number]['data'],
			}))
			const exchangeCount = typedSessions.reduce(
				(total, session) =>
					total + parseOpenCodeSession(session.sessionId, session.project, session.data).length,
				0
			)
			if (exchangeCount > MAX_CONVERSATION_EXCHANGES) {
				throw new Error(
					`Batch contains ${exchangeCount} exchanges; maximum is ${MAX_CONVERSATION_EXCHANGES}`
				)
			}

			const previousIndex = await loadConversationIndex(storage)
			const affectedSessionIds = new Set(typedSessions.map((session) => session.sessionId))
			const previousExchangeIds = new Set(
				previousIndex.exchanges
					.filter((exchange) => affectedSessionIds.has(exchange.sessionId))
					.map((exchange) => exchange.id)
			)

			const result = await indexSessions(storage, typedSessions)
			const conversationIndex = await loadConversationIndex(storage)
			const currentExchanges = conversationIndex.exchanges.filter((exchange) =>
				affectedSessionIds.has(exchange.sessionId)
			)
			const currentExchangeIds = new Set(currentExchanges.map((exchange) => exchange.id))
			await mapWithConcurrency(
				[...previousExchangeIds].filter((exchangeId) => !currentExchangeIds.has(exchangeId)),
				CONVERSATION_INDEX_CONCURRENCY,
				async (exchangeId) => {
					await index.delete(`conversations/exchanges/${exchangeId}.txt`)
				}
			)
			await mapWithConcurrency(
				currentExchanges,
				CONVERSATION_INDEX_CONCURRENCY,
				async (exchange) => {
					const content = `[${exchange.project}] ${exchange.userPrompt}\n\nResponse: ${exchange.assistantResponse}`
					const parsedTimestamp = Date.parse(exchange.timestamp)
					await index.update({
						path: `conversations/exchanges/${exchange.id}.txt`,
						content,
						updatedAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined,
					})
				}
			)
			return {
				success: true,
				added: result.added,
				updated: result.updated,
				unchanged: result.unchanged,
				indexed: currentExchanges.length,
			}
		}
	)

	tool(
		'expand_conversation',
		'Load full context from a past conversation session.',
		{
			sessionId: z
				.string()
				.refine(isSafeSessionId, 'Invalid session ID')
				.describe('Session ID from search results'),
			exchangeId: z.string().max(260).optional().describe('Specific exchange ID to center on'),
		},
		async ({ sessionId, exchangeId }, { storage }) => {
			const result = await expandConversation(storage, sessionId, exchangeId)
			if (!result) {
				return errResult('Session not found', { sessionId })
			}
			return result as Record<string, unknown>
		}
	)

	tool(
		'conversation_stats',
		'Get statistics about indexed conversations.',
		{},
		async (_args, { storage }) => (await getConversationStats(storage)) as Record<string, unknown>
	)

	// ==================== Reminder Tools ====================

	tool(
		'schedule_reminder',
		"Create a reminder. Use type 'cron' for recurring (e.g., '0 9 * * *' for 9am UTC daily) or 'once' for one-shot (ISO datetime).",
		{
			id: z
				.string()
				.regex(/^[A-Za-z0-9_-]{1,128}$/)
				.describe('Unique identifier for this reminder'),
			type: z.enum(['cron', 'once']).describe("'cron' for recurring, 'once' for one-shot"),
			expression: z
				.string()
				.trim()
				.min(1)
				.max(128)
				.describe("Cron expression (e.g., '0 9 * * *') or ISO datetime for one-shot"),
			description: z.string().trim().min(1).max(500).describe('What this reminder is for'),
			payload: z.string().min(1).max(10_000).describe('Message/instructions when reminder fires'),
			model: z.string().max(256).optional().describe('Optional model hint for client'),
		},
		async (args, { storage }) => {
			const reminder = await scheduleReminder(storage, args)
			return { success: true, reminder }
		}
	)

	tool('list_reminders', 'List all scheduled reminders.', {}, async (_args, { storage }) => ({
		reminders: await listReminders(storage),
	}))

	tool(
		'remove_reminder',
		'Remove a scheduled reminder.',
		{
			id: z
				.string()
				.regex(/^[A-Za-z0-9_-]{1,128}$/)
				.describe('ID of the reminder to remove'),
		},
		async ({ id }, { storage }) => {
			const removed = await removeReminder(storage, id)
			return { success: removed, message: removed ? 'Removed' : 'Not found' }
		}
	)

	tool(
		'check_reminders',
		'Check for fired reminders. Call on startup to see if any scheduled tasks need attention.',
		{},
		async (_args, { storage }) => {
			const fired = await checkReminders(storage)
			return {
				fired,
				count: fired.length,
				hint:
					fired.length > 0
						? 'Process these reminders based on their payload'
						: 'No reminders to process',
			}
		}
	)

	// ==================== Reflection Tools ====================

	tool(
		'run_reflection',
		'Run an agentic reflection over your memory now: a quick scan auto-applies low-risk fixes (typos, whitespace), while deep analysis stages substantive improvements for review. Reflection is opt-out — disable it with set_config { reflectionsEnabled: false }. All LLM spend is billed to your Cloudflare account.',
		{},
		async (_args, userCtx) => {
			const result = await runReflection(userCtx)
			if (!result.success) return errResult('Reflection failed', result)
			return okResult(result, result.skipped ? 'Reflection skipped' : 'Reflection complete')
		}
	)

	tool(
		'list_pending_reflections',
		'List pending reflection files awaiting review.',
		{},
		async (_args, { storage }) => {
			const pending = await listPendingReflections(storage)
			return {
				pending,
				count: pending.length,
				hint:
					pending.length > 0
						? 'Use read to view details, apply_reflection_changes to apply proposed edits'
						: 'No pending reflections',
			}
		}
	)

	tool(
		'apply_reflection_changes',
		'Apply proposed changes from a reflection. Reads the structured JSON sidecar (preferred) or falls back to parsing the markdown, applies specified edits, and optionally archives the reflection.',
		{
			date: ReflectionDate.describe('Date of the reflection (YYYY-MM-DD)'),
			editIndices: z
				.array(z.number().int().positive())
				.min(1)
				.max(100)
				.optional()
				.describe('Which edits to apply (1-indexed). Omit to apply all.'),
			archive: z
				.boolean()
				.optional()
				.default(true)
				.describe('Archive the reflection after applying'),
		},
		async ({ date, editIndices, archive = true }, { storage, index }) => {
			const pendingPath = `memory/reflections/pending/${date}.md`

			let edits: ProposedEdit[]
			const sidecar = await readStagedReflectionData(storage, date)
			if (sidecar) {
				edits = sidecar.proposedEdits
			} else {
				const file = await storage.read(pendingPath)
				if (!file) {
					return errResult('Reflection not found', { date })
				}
				edits = parseProposedEditsFromMarkdown(file.content)
			}

			if (edits.length === 0) {
				if (archive) await archiveReflection(storage, pendingPath)
				return { success: true, message: 'No proposed edits to apply', archived: archive }
			}

			if (editIndices?.some((index) => index > edits.length)) {
				return errResult('editIndices contains an index outside the proposed edit list', {
					available_edits: edits.length,
				})
			}
			const requestedIndices = editIndices ? new Set(editIndices) : undefined
			const toApply = requestedIndices
				? edits.filter((_, index) => requestedIndices.has(index + 1))
				: edits

			const results: Array<{ path: string; action: string; success: boolean; error?: string }> = []
			for (const edit of toApply) {
				try {
					if (!edit.path.startsWith('memory/') || isManagedMemoryPath(edit.path)) {
						throw new Error('Reflection edits may only change user-authored files under memory/')
					}
					switch (edit.action) {
						case 'replace':
						case 'create': {
							if (!edit.content) throw new Error(`Content required for ${edit.action}`)
							const existing = await storage.read(edit.path)
							if (edit.action === 'create' && existing?.content !== edit.content) {
								throw new Error(`File already exists with different content: ${edit.path}`)
							}
							if (edit.action === 'replace' && !existing) {
								throw new Error(`File not found: ${edit.path}`)
							}
							if (edit.action === 'replace' && existing && existing.content !== edit.content) {
								await verifyReflectionSource(edit, existing.content)
							}
							// Rewriting identical content is intentional: it makes retries repair
							// a prior embedding failure without changing the file again.
							const writeResult = await indexWrite(index, storage, edit.path, edit.content)
							if (writeResult.embedding_error) {
								throw new Error(
									`File applied, but search indexing failed: ${writeResult.embedding_error}. Call reindex before archiving.`
								)
							}
							results.push({ path: edit.path, action: edit.action, success: true })
							break
						}
						case 'append': {
							if (!edit.content) throw new Error('Content required for append')
							const existing = await storage.read(edit.path)
							if (!existing) throw new Error(`File not found: ${edit.path}`)
							const suffix = `\n${edit.content}`
							if (!edit.expectedContentHash) {
								throw new Error(
									'Reflection lacks source-version metadata; run a new reflection before applying it'
								)
							}
							const currentHash = await contentHash(existing.content)
							let appendedContent: string
							if (currentHash === edit.expectedContentHash) {
								appendedContent = `${existing.content}${suffix}`
							} else if (
								existing.content.endsWith(suffix) &&
								(await contentHash(existing.content.slice(0, -suffix.length))) ===
									edit.expectedContentHash
							) {
								appendedContent = existing.content
							} else {
								throw new Error(`File changed since reflection was generated: ${edit.path}`)
							}
							const writeResult = await indexWrite(index, storage, edit.path, appendedContent)
							if (writeResult.embedding_error) {
								throw new Error(
									`File applied, but search indexing failed: ${writeResult.embedding_error}. Call reindex before archiving.`
								)
							}
							results.push({ path: edit.path, action: edit.action, success: true })
							break
						}
						case 'delete': {
							const existing = await storage.read(edit.path)
							if (existing) await verifyReflectionSource(edit, existing.content)
							await storage.delete(edit.path)
							await index.delete(edit.path)
							results.push({ path: edit.path, action: edit.action, success: true })
							break
						}
						default:
							throw new Error(`Unsupported reflection action: ${String(edit.action)}`)
					}
				} catch (e) {
					results.push({
						path: edit.path,
						action: edit.action,
						success: false,
						error: e instanceof Error ? e.message : String(e),
					})
				}
			}

			const allSucceeded = results.every((r) => r.success)
			let archived = false
			if (archive && allSucceeded) {
				await archiveReflection(storage, pendingPath)
				archived = true
			}

			const response = {
				success: allSucceeded,
				applied: results.filter((result) => result.success).length,
				failed: results.filter((result) => !result.success).length,
				results,
				archived,
			}
			return allSucceeded ? response : errResult('Some reflection edits failed', response)
		}
	)

	tool(
		'archive_reflection',
		'Archive a pending reflection without applying changes (mark as reviewed).',
		{ date: ReflectionDate.describe('Date of the reflection (YYYY-MM-DD)') },
		async ({ date }, { storage }) => {
			const pendingPath = `memory/reflections/pending/${date}.md`
			const archivePath = await archiveReflection(storage, pendingPath)
			if (!archivePath) {
				return errResult('Reflection not found', { date })
			}
			return { success: true, archivedTo: archivePath }
		}
	)

	// ==================== Config Tools ====================

	tool(
		'get_config',
		'Get your Agent Memory configuration: whether reflections are enabled, the configured notification webhook, and any reflection model overrides.',
		{},
		async (_args, { storage }) => {
			const config = await loadConfig(storage)
			// Webhook URLs often contain credentials in their path. Return only the
			// host, and never echo header values.
			return {
				reflectionsEnabled: config.reflectionsEnabled,
				webhookConfigured: Boolean(config.webhookUrl),
				webhookHost: config.webhookUrl ? new URL(config.webhookUrl).host : undefined,
				webhookHeaderKeys: config.webhookHeaders ? Object.keys(config.webhookHeaders) : [],
				reflectionModel: config.reflectionModel,
				reflectionModelFast: config.reflectionModelFast,
			}
		}
	)

	tool(
		'set_config',
		'Update your Agent Memory configuration. Set `reflectionsEnabled` to opt out of reflections. Set `webhookUrl` (+ optional `webhookHeaders`) to receive a generic JSON POST when a reflection completes. Use an automation endpoint to adapt the payload for vendor-specific webhooks. Pass `clearWebhook: true` to remove it.',
		{
			reflectionsEnabled: z.boolean().optional().describe('Enable/disable reflections.'),
			webhookUrl: z
				.string()
				.max(2_048)
				.url()
				.refine(
					(url) => ['http:', 'https:'].includes(new URL(url).protocol),
					'Expected HTTP(S) URL'
				)
				.optional()
				.describe('Outbound webhook URL for reflection notifications.'),
			webhookHeaders: z
				.record(z.string().min(1).max(128), z.string().max(4_096))
				.optional()
				.refine((headers) => !headers || Object.keys(headers).length <= 20, 'Maximum 20 headers')
				.describe('Optional headers sent with the webhook POST (e.g. an auth token).'),
			clearWebhook: z.boolean().optional().describe('Remove the configured webhook.'),
			reflectionModel: ModelId.optional().describe(
				'Override the deep-analysis Workers AI model id.'
			),
			reflectionModelFast: ModelId.optional().describe(
				'Override the quick-scan Workers AI model id.'
			),
		},
		async (args, { storage }) => {
			const patch: Record<string, unknown> = {}
			if (args.reflectionsEnabled !== undefined) patch.reflectionsEnabled = args.reflectionsEnabled
			if (args.reflectionModel !== undefined) patch.reflectionModel = args.reflectionModel
			if (args.reflectionModelFast !== undefined)
				patch.reflectionModelFast = args.reflectionModelFast
			if (args.clearWebhook) {
				patch.webhookUrl = undefined
				patch.webhookHeaders = undefined
			} else {
				if (args.webhookUrl !== undefined) patch.webhookUrl = args.webhookUrl
				if (args.webhookHeaders !== undefined) patch.webhookHeaders = args.webhookHeaders
			}
			const next = await saveConfig(storage, patch)
			return okResult(
				{
					reflectionsEnabled: next.reflectionsEnabled,
					webhookConfigured: Boolean(next.webhookUrl),
					reflectionModel: next.reflectionModel,
					reflectionModelFast: next.reflectionModelFast,
				},
				'Config updated'
			)
		}
	)
}

/**
 * Fallback parser for reflections without a JSON sidecar.
 */
async function verifyReflectionSource(edit: ProposedEdit, currentContent: string): Promise<void> {
	if (!edit.expectedContentHash) {
		throw new Error(
			'Reflection lacks source-version metadata; run a new reflection before applying it'
		)
	}
	if ((await contentHash(currentContent)) !== edit.expectedContentHash) {
		throw new Error(`File changed since reflection was generated: ${edit.path}`)
	}
}

function parseProposedEditsFromMarkdown(content: string): ProposedEdit[] {
	const edits: ProposedEdit[] = []
	const editPattern =
		/###\s*\d+\.\s*(REPLACE|APPEND|DELETE|CREATE):\s*(\S+)\s*\n\n\*\*Reason:\*\*\s*([^\n]+)\n(?:\n\*\*Content:\*\*\n```\n([\s\S]*?)\n```)?/g

	for (let match = editPattern.exec(content); match !== null; match = editPattern.exec(content)) {
		const [, action, path, reason, editContent] = match
		edits.push({
			path,
			action: action.toLowerCase() as ProposedEdit['action'],
			reason,
			content: editContent,
		})
	}
	return edits
}
