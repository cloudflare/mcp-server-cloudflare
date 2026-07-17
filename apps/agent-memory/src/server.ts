import { z } from 'zod'

import { getProps } from '@repo/mcp-common/src/get-props'

import { loadConfig, saveConfig } from './config'
import {
	expandConversation,
	getConversationStats,
	indexSessions,
	loadConversationIndex,
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
import { extractSnippet, truncateWithMeta } from './truncate'
import { buildUserContext } from './user-context'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ZodRawShape } from 'zod'
import type { AuthProps } from '@repo/mcp-common/src/cloudflare-oauth-handler'
import type { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import type { Env } from './agent-memory.context'
import type { ToolResult } from './helpers'
import type { ProposedEdit } from './reflection/tool-executor'
import type { UserContext } from './user-context'

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
 * {@link UserContext} (per-user R2 storage, per-user Workers AI, per-user
 * search index) instead of a raw account id, and so every handler shares the
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
				.union([z.string(), z.array(z.string())])
				.describe("File path or array of paths, e.g., 'memory/learnings.md'"),
		},
		async ({ path }, { storage }) => {
			if (Array.isArray(path)) {
				if (path.length > 50) {
					return errResult('Cannot read more than 50 paths in a single call')
				}
				const files = await Promise.all(
					path.map(async (p) => {
						const file = await storage.read(p)
						if (!file) return [p, { error: 'File not found' }] as const
						const t = truncateWithMeta(file.content)
						const entry: Record<string, unknown> = {
							content: t.content,
							updated_at: file.updated_at,
							size: file.size,
						}
						if (t.truncated) {
							entry.truncated = true
							entry.original_size = t.original_size
						}
						return [p, entry] as const
					})
				)
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
				body.original_size = t.original_size
			}
			const prefix = t.truncated
				? `Read ${path} (${t.original_size} bytes, truncated to ${t.content.length})`
				: `Read ${path} (${file.size} bytes)`
			return okResult(body, prefix)
		}
	)

	tool(
		'write',
		'Write content to a file. Automatically updates the search index, extracts tags from YAML frontmatter, and indexes Obsidian-style [[wikilinks]]. Returns semantic overlap warnings for memory/ paths by default.\n\nPass `detect_overlaps: false` to skip the post-write similarity search.\n\nEmpty content is refused by default — pass `allow_empty: true` to truncate a file deliberately.',
		{
			path: z.string().describe("File path, e.g., 'memory/learnings.md'"),
			content: z.string().describe('Content to write'),
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
						path: z.string(),
						content: z.string(),
						detect_overlaps: z.boolean().optional(),
						allow_empty: z.boolean().optional(),
					})
				)
				.min(1)
				.max(50)
				.describe('Up to 50 files to write.'),
		},
		async ({ files }, userCtx) => {
			const results = await Promise.all(
				files.map(async (f) => {
					try {
						const r = await indexWrite(userCtx.index, userCtx.storage, f.path, f.content, {
							detectOverlaps: f.detect_overlaps ?? false,
							allowEmpty: f.allow_empty ?? false,
						})
						return { ...r, path: f.path, success: true }
					} catch (e) {
						return {
							path: f.path,
							success: false,
							error: e instanceof Error ? e.message : String(e),
						}
					}
				})
			)
			const ok = results.filter((r) => r.success).length
			return okResult({ results }, `Wrote ${ok}/${files.length} files`)
		}
	)

	tool(
		'list',
		'List files in a directory. Pass `tags` to restrict to files matching every tag (intersection).',
		{
			path: z.string().optional().describe('Directory path, defaults to root'),
			recursive: z.boolean().optional().default(false).describe('List recursively'),
			tags: z
				.array(z.string())
				.optional()
				.describe('If provided, only return files tagged with all of these'),
		},
		async ({ path, recursive, tags }, { storage, index }) => {
			const files = await storage.list(path, recursive)
			if (!tags || tags.length === 0) {
				return { files }
			}
			const { paths } = await index.filesWithTags(tags)
			const allowed = new Set(paths)
			return { files: files.filter((f) => allowed.has(f.path)), filtered_by_tags: tags }
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
			query: z.string().describe('Natural language query'),
			limit: z.number().optional().default(5).describe('Max results to return'),
			tags: z
				.array(z.string())
				.optional()
				.describe('If provided, only match files tagged with all of these'),
			scope: z
				.enum(['memory', 'conversations', 'all'])
				.optional()
				.default('memory')
				.describe('What to search. Defaults to memory files only.'),
		},
		async ({ query, limit, tags, scope }, { storage, index }) => {
			const effectiveLimit = limit ?? 5
			const searchScope = scope ?? 'memory'
			const overshoot = searchScope === 'memory' ? effectiveLimit : effectiveLimit * 2
			const rawResults = await index.search({
				query,
				limit: overshoot,
				tags,
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

			const enrichedMemory = await Promise.all(
				memoryHits.slice(0, effectiveLimit).map(async (r) => {
					const file = await storage.read(r.id)
					return { path: r.id, snippet: file ? extractSnippet(file.content) : '', score: r.score }
				})
			)

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
		'history',
		'List previous versions of a file. Object versioning is not exposed through the managed REST storage, so this returns an empty list with a hint.',
		{
			path: z.string().describe('File path'),
			limit: z.number().optional().default(10).describe('Max versions to return'),
		},
		async ({ path, limit }, { storage }) => {
			const versions = await storage.getVersions(path, limit)
			if (versions.length === 0) {
				return {
					versions: [],
					versioning_enabled: false,
					hint: 'Object version history is not available through the managed Agent Memory server.',
				}
			}
			return { versions, versioning_enabled: true }
		}
	)

	tool(
		'rollback',
		'Restore a file to a previous version. Not available in the managed server (object versioning is not exposed through REST storage).',
		{
			path: z.string().describe('File path'),
			version_id: z.string().describe('Version ID to restore'),
		},
		async ({ path, version_id }, { storage }) => {
			const fileContent = await storage.getVersion(path, version_id)
			if (!fileContent) {
				return errResult('Version not found', { path, version_id })
			}
			await storage.write(path, fileContent)
			return { success: true, restored_from: version_id }
		}
	)

	tool(
		'get_backlinks',
		'List files that link to the given target via Obsidian-style wikilinks ([[target]]).',
		{
			target: z
				.string()
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
			query: z.string().describe("What to search for, e.g., 'TypeScript errors', 'API design'"),
			limit: z.number().optional().default(5).describe('Max results to return'),
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
				limit: effectiveLimit * 2,
				timeWeight: true,
			})
			const results = rawResults
				.filter((r) => r.id.startsWith('conversations/exchanges/'))
				.slice(0, effectiveLimit)
				.map((r) => {
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
						sessionId: z.string(),
						project: z.string(),
						data: z.record(z.string(), z.unknown()),
					})
				)
				.describe('Array of session objects to index'),
		},
		async ({ sessions }, { storage, index }) => {
			const result = await indexSessions(
				storage,
				sessions.map((s) => ({
					sessionId: s.sessionId,
					project: s.project,
					data: s.data as unknown as Parameters<typeof indexSessions>[1][number]['data'],
				}))
			)

			const conversationIndex = await loadConversationIndex(storage)
			let indexed = 0
			for (const exchange of conversationIndex.exchanges) {
				const content = `[${exchange.project}] ${exchange.userPrompt}\n\nResponse: ${exchange.assistantResponse}`
				await index.update({ path: `conversations/exchanges/${exchange.id}.txt`, content })
				indexed++
			}
			return {
				success: true,
				added: result.added,
				updated: result.updated,
				unchanged: result.unchanged,
				totalIndexed: indexed,
			}
		}
	)

	tool(
		'expand_conversation',
		'Load full context from a past conversation session.',
		{
			sessionId: z.string().describe('Session ID from search results'),
			exchangeId: z.string().optional().describe('Specific exchange ID to center on'),
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
			id: z.string().describe('Unique identifier for this reminder'),
			type: z.enum(['cron', 'once']).describe("'cron' for recurring, 'once' for one-shot"),
			expression: z
				.string()
				.describe("Cron expression (e.g., '0 9 * * *') or ISO datetime for one-shot"),
			description: z.string().describe('What this reminder is for'),
			payload: z.string().describe('Message/instructions when reminder fires'),
			model: z.string().optional().describe('Optional model hint for client'),
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
		{ id: z.string().describe('ID of the reminder to remove') },
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
		'Run an agentic reflection over your memory now: a quick scan auto-applies low-risk fixes (typos, whitespace) and a deep analysis proposes and applies substantive improvements. Reflection is opt-out — disable it with set_config { reflectionsEnabled: false }. All LLM spend is billed to your Cloudflare account.',
		{},
		async (_args, userCtx) => {
			const result = await runReflection(userCtx)
			return okResult(
				result,
				result.skipped
					? 'Reflection skipped'
					: `Reflection ${result.success ? 'complete' : 'failed'}`
			)
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
			date: z.string().describe('Date of the reflection (YYYY-MM-DD)'),
			editIndices: z
				.array(z.number())
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

			const toApply = editIndices ? edits.filter((_, i) => editIndices.includes(i + 1)) : edits

			const results: Array<{ path: string; action: string; success: boolean; error?: string }> = []
			for (const edit of toApply) {
				try {
					switch (edit.action) {
						case 'replace':
						case 'create':
							if (edit.content) await indexWrite(index, storage, edit.path, edit.content)
							results.push({ path: edit.path, action: edit.action, success: true })
							break
						case 'append':
							if (edit.content) {
								const existing = await storage.read(edit.path)
								const newContent = existing ? `${existing.content}\n${edit.content}` : edit.content
								await indexWrite(index, storage, edit.path, newContent)
							}
							results.push({ path: edit.path, action: edit.action, success: true })
							break
						case 'delete':
							await storage.delete(edit.path)
							await index.delete(edit.path)
							results.push({ path: edit.path, action: edit.action, success: true })
							break
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

			return {
				success: allSucceeded,
				applied: results.filter((r) => r.success).length,
				failed: results.filter((r) => !r.success).length,
				results,
				archived,
			}
		}
	)

	tool(
		'archive_reflection',
		'Archive a pending reflection without applying changes (mark as reviewed).',
		{ date: z.string().describe('Date of the reflection (YYYY-MM-DD)') },
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
			// Never echo raw webhook auth headers back verbatim; report presence only.
			return {
				reflectionsEnabled: config.reflectionsEnabled,
				webhookConfigured: Boolean(config.webhookUrl),
				webhookUrl: config.webhookUrl,
				webhookHeaderKeys: config.webhookHeaders ? Object.keys(config.webhookHeaders) : [],
				reflectionModel: config.reflectionModel,
				reflectionModelFast: config.reflectionModelFast,
			}
		}
	)

	tool(
		'set_config',
		'Update your Agent Memory configuration. Set `reflectionsEnabled` to opt out of reflections. Set `webhookUrl` (+ optional `webhookHeaders`) to receive a generic JSON POST when a reflection completes — works with any endpoint (Slack, Discord, a Worker, n8n, etc.). Pass `clearWebhook: true` to remove it.',
		{
			reflectionsEnabled: z.boolean().optional().describe('Enable/disable reflections.'),
			webhookUrl: z
				.string()
				.url()
				.optional()
				.describe('Outbound webhook URL for reflection notifications.'),
			webhookHeaders: z
				.record(z.string(), z.string())
				.optional()
				.describe('Optional headers sent with the webhook POST (e.g. an auth token).'),
			clearWebhook: z.boolean().optional().describe('Remove the configured webhook.'),
			reflectionModel: z
				.string()
				.optional()
				.describe('Override the deep-analysis Workers AI model id.'),
			reflectionModelFast: z
				.string()
				.optional()
				.describe('Override the quick-scan Workers AI model id.'),
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
