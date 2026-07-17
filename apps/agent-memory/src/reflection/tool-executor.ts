/**
 * Executes the bounded tools available to the reflection models.
 * Substantive edits are staged; only explicitly low-risk fixes are immediate.
 */

import { contentHash } from '../content-hash'
import { indexWrite } from '../search/index-write'
import { isManagedMemoryPath, validateMemoryPath } from '../storage/r2'

import type { LLMToolCall } from '../llm/types'
import type { MemoryIndexClient } from '../search/client'
import type { R2Storage } from '../storage/r2'

export interface ProposedEdit {
	path: string
	action: 'replace' | 'append' | 'delete' | 'create'
	content?: string
	reason: string
	/** Hash of the source content inspected by reflection, for safe apply. */
	expectedContentHash?: string
}

export interface AutoAppliedFix {
	path: string
	fixType: 'typo' | 'whitespace' | 'newline' | 'duplicate' | 'formatting'
	oldText?: string
	newText?: string
	reason: string
}

export interface FlaggedIssue {
	path: string
	issue: string
}

export interface ToolExecutionContext {
	storage: R2Storage
	index: MemoryIndexClient
	proposedEdits: ProposedEdit[]
	autoAppliedFixes: AutoAppliedFix[]
	flaggedIssues: FlaggedIssue[]
}

export interface ToolResult {
	success: boolean
	result?: unknown
	error?: string
}

const EDIT_ACTIONS = ['replace', 'append', 'delete', 'create'] as const
const FIX_TYPES = ['typo', 'whitespace', 'newline', 'duplicate', 'formatting'] as const
const MAX_REFLECTION_ITEMS = 100

export async function executeReflectionTool(
	toolCall: LLMToolCall,
	context: ToolExecutionContext
): Promise<ToolResult> {
	const { name, arguments: args } = toolCall

	try {
		switch (name) {
			case 'searchMemory':
				return await executeSearch(args as { query?: unknown; limit?: unknown }, context)
			case 'readFile':
				return await executeRead(args as { path?: unknown }, context)
			case 'listFiles':
				return await executeList(args as { path?: unknown; recursive?: unknown }, context)
			case 'getBacklinks':
				return await executeGetBacklinks(args as { target?: unknown }, context)
			case 'proposeEdit':
				return await executePropose(args, context)
			case 'autoApply':
				return await executeAutoApply(args, context)
			case 'flagForDeepAnalysis':
				return executeFlagForDeepAnalysis(args, context)
			case 'finishReflection':
				return executeFinishReflection(args)
			case 'finishQuickScan':
				return executeFinishQuickScan(args)
			default:
				return { success: false, error: `Unknown tool: ${name}` }
		}
	} catch (error) {
		return {
			success: false,
			error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

async function executeSearch(
	args: { query?: unknown; limit?: unknown },
	context: ToolExecutionContext
): Promise<ToolResult> {
	if (typeof args.query !== 'string' || args.query.length < 1 || args.query.length > 8_000) {
		return { success: false, error: 'query must be 1-8000 characters' }
	}
	const requestedLimit = args.limit ?? 5
	if (!Number.isInteger(requestedLimit) || (requestedLimit as number) < 1) {
		return { success: false, error: 'limit must be a positive integer' }
	}
	const limit = Math.min(requestedLimit as number, 20)

	try {
		const results = await context.index.search({ query: args.query, limit, scope: 'memory' })
		return {
			success: true,
			result: { query: args.query, matches: results, count: results.length },
		}
	} catch (error) {
		return { success: false, error: `Search error: ${String(error)}` }
	}
}

async function executeRead(
	args: { path?: unknown },
	context: ToolExecutionContext
): Promise<ToolResult> {
	const path = reflectionFilePath(args.path)
	const file = await context.storage.read(path)
	if (!file) return { success: false, error: `File not found: ${path}` }

	const maxLength = 15_000
	const truncated = file.content.length > maxLength
	const content = truncated
		? `${file.content.slice(0, maxLength)}\n...[truncated, ${file.content.length - maxLength} characters omitted]...`
		: file.content
	return {
		success: true,
		result: { path, content, size: file.size, updated_at: file.updated_at, truncated },
	}
}

async function executeList(
	args: { path?: unknown; recursive?: unknown },
	context: ToolExecutionContext
): Promise<ToolResult> {
	const path = reflectionDirectoryPath(args.path)
	if (args.recursive !== undefined && typeof args.recursive !== 'boolean') {
		return { success: false, error: 'recursive must be a boolean' }
	}
	const files = await context.storage.list(path, args.recursive ?? false)
	return {
		success: true,
		result: {
			path,
			files: files.map((file) => ({
				path: file.path,
				size: file.size,
				updated_at: file.updated_at,
			})),
			count: files.length,
		},
	}
}

async function executeGetBacklinks(
	args: { target?: unknown },
	context: ToolExecutionContext
): Promise<ToolResult> {
	if (typeof args.target !== 'string' || args.target.length < 1 || args.target.length > 1_024) {
		return { success: false, error: 'target must be 1-1024 characters' }
	}
	try {
		const { backlinks } = await context.index.backlinks(args.target)
		return {
			success: true,
			result: { target: args.target, backlinks, count: backlinks.length },
		}
	} catch (error) {
		return { success: false, error: `Backlinks error: ${String(error)}` }
	}
}

async function executePropose(
	args: Record<string, unknown>,
	context: ToolExecutionContext
): Promise<ToolResult> {
	if (!EDIT_ACTIONS.includes(args.action as ProposedEdit['action'])) {
		return { success: false, error: 'Invalid edit action' }
	}
	if (typeof args.reason !== 'string' || args.reason.length < 1 || args.reason.length > 2_000) {
		return { success: false, error: 'reason must be 1-2000 characters' }
	}
	if (args.content !== undefined && typeof args.content !== 'string') {
		return { success: false, error: 'content must be a string' }
	}
	if (typeof args.content === 'string' && args.content.length > 1_000_000) {
		return { success: false, error: 'content exceeds 1000000 characters' }
	}
	if (context.proposedEdits.length >= MAX_REFLECTION_ITEMS) {
		return { success: false, error: `Maximum ${MAX_REFLECTION_ITEMS} proposed edits` }
	}

	const action = args.action as ProposedEdit['action']
	const path = reflectionFilePath(args.path)
	const existing = await context.storage.read(path)
	if (action === 'create' && existing)
		return { success: false, error: `File already exists: ${path}` }
	if (action !== 'create' && !existing) return { success: false, error: `File not found: ${path}` }
	if (action !== 'delete' && !args.content) {
		return { success: false, error: `Content required for ${action} action` }
	}

	context.proposedEdits.push({
		path,
		action,
		content: args.content as string | undefined,
		reason: args.reason,
		expectedContentHash: existing ? await contentHash(existing.content) : undefined,
	})
	return {
		success: true,
		result: {
			message: `Edit staged: ${action} ${path}`,
			totalProposed: context.proposedEdits.length,
		},
	}
}

async function executeAutoApply(
	args: Record<string, unknown>,
	context: ToolExecutionContext
): Promise<ToolResult> {
	if (!FIX_TYPES.includes(args.fixType as AutoAppliedFix['fixType'])) {
		return { success: false, error: 'Invalid fix type' }
	}
	if (typeof args.reason !== 'string' || args.reason.length < 1 || args.reason.length > 2_000) {
		return { success: false, error: 'reason must be 1-2000 characters' }
	}
	if (args.oldText !== undefined && typeof args.oldText !== 'string') {
		return { success: false, error: 'oldText must be a string' }
	}
	if (args.newText !== undefined && typeof args.newText !== 'string') {
		return { success: false, error: 'newText must be a string' }
	}
	if ((args.oldText as string | undefined)?.length && (args.oldText as string).length > 100_000) {
		return { success: false, error: 'oldText is too large' }
	}
	if ((args.newText as string | undefined)?.length && (args.newText as string).length > 100_000) {
		return { success: false, error: 'newText is too large' }
	}
	if (context.autoAppliedFixes.length >= MAX_REFLECTION_ITEMS) {
		return { success: false, error: `Maximum ${MAX_REFLECTION_ITEMS} automatic fixes` }
	}

	const fixType = args.fixType as AutoAppliedFix['fixType']
	const oldText = args.oldText as string | undefined
	const newText = args.newText as string | undefined
	const path = reflectionFilePath(args.path)
	const file = await context.storage.read(path)
	if (!file) return { success: false, error: `File not found: ${path}` }

	let content = file.content
	switch (fixType) {
		case 'typo':
		case 'whitespace':
			if (!oldText || newText === undefined) {
				return { success: false, error: `oldText and newText required for ${fixType} fix` }
			}
			if (!content.includes(oldText)) return { success: false, error: 'oldText not found in file' }
			content = content.replace(oldText, newText)
			break
		case 'newline':
			content = `${content.trimEnd()}\n`
			break
		case 'duplicate':
			if (!oldText) return { success: false, error: 'oldText required for duplicate fix' }
			if (!content.includes(oldText)) return { success: false, error: 'oldText not found in file' }
			content = content.replace(oldText, newText ?? '')
			break
		case 'formatting':
			if (!oldText || newText === undefined) {
				return { success: false, error: 'oldText and newText required for formatting fix' }
			}
			if (!content.includes(oldText)) return { success: false, error: 'oldText not found in file' }
			content = content.replace(oldText, newText)
			break
	}

	if (content === file.content) {
		return { success: false, error: `Proposed ${fixType} fix did not change the file` }
	}
	const writeResult = await indexWrite(context.index, context.storage, path, content, {
		detectOverlaps: false,
	})
	context.autoAppliedFixes.push({
		path,
		fixType,
		oldText,
		newText,
		reason: args.reason,
	})
	if (writeResult.embedding_error) {
		context.flaggedIssues.push({
			path,
			issue: `Search indexing failed after an automatic fix: ${writeResult.embedding_error}. Run reindex before archiving this reflection.`,
		})
		return {
			success: false,
			error: `Fix was applied, but search indexing failed: ${writeResult.embedding_error}`,
		}
	}
	return {
		success: true,
		result: {
			message: `Auto-applied ${fixType} fix to ${path}`,
			totalAutoApplied: context.autoAppliedFixes.length,
		},
	}
}

function executeFlagForDeepAnalysis(
	args: Record<string, unknown>,
	context: ToolExecutionContext
): ToolResult {
	if (typeof args.issue !== 'string' || args.issue.length < 1 || args.issue.length > 2_000) {
		return { success: false, error: 'issue must be 1-2000 characters' }
	}
	if (context.flaggedIssues.length >= MAX_REFLECTION_ITEMS) {
		return { success: false, error: `Maximum ${MAX_REFLECTION_ITEMS} flagged issues` }
	}
	const path = reflectionFilePath(args.path)
	context.flaggedIssues.push({ path, issue: args.issue })
	return {
		success: true,
		result: {
			message: `Flagged for deep analysis: ${path}`,
			totalFlagged: context.flaggedIssues.length,
		},
	}
}

function executeFinishReflection(args: Record<string, unknown>): ToolResult {
	if (typeof args.summary !== 'string' || args.summary.length < 1 || args.summary.length > 2_000) {
		return { success: false, error: 'summary must be 1-2000 characters' }
	}
	if (!nonNegativeInteger(args.proposedChanges) || !nonNegativeInteger(args.autoApplied)) {
		return { success: false, error: 'finish counts must be non-negative integers' }
	}
	return { success: true, result: { finished: true, ...args } }
}

function executeFinishQuickScan(args: Record<string, unknown>): ToolResult {
	if (!nonNegativeInteger(args.autoApplied) || !nonNegativeInteger(args.flaggedForDeepAnalysis)) {
		return { success: false, error: 'finish counts must be non-negative integers' }
	}
	return { success: true, result: { finished: true, phase: 'quick_scan', ...args } }
}

function nonNegativeInteger(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 0
}

function reflectionFilePath(value: unknown): string {
	if (typeof value !== 'string') throw new Error('path is required')
	const path = validateMemoryPath(value)
	if (!path.startsWith('memory/') || isManagedMemoryPath(path)) {
		throw new Error('Reflection may only access user-authored files under memory/')
	}
	return path
}

function reflectionDirectoryPath(value: unknown): string {
	if (typeof value !== 'string') throw new Error('path is required')
	const normalized = value.endsWith('/') ? value.slice(0, -1) : value
	if (normalized === 'memory') return normalized
	return reflectionFilePath(normalized)
}

export function createExecutionContext(
	storage: R2Storage,
	index: MemoryIndexClient
): ToolExecutionContext {
	return { storage, index, proposedEdits: [], autoAppliedFixes: [], flaggedIssues: [] }
}
