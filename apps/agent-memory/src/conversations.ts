/**
 * Conversation Indexing for OpenCode Sessions
 *
 * Parses OpenCode session files and indexes individual exchanges
 * (user prompt + assistant response) for semantic search.
 *
 * OpenCode stores sessions at: ~/.local/share/opencode/storage/session/{project}/{session}.json
 * Each session file contains an array of messages with roles and content.
 */

import { contentHash } from './content-hash'

import type { R2Storage } from './storage/r2'

// Conversation exchange - one user prompt + assistant response pair
export interface ConversationExchange {
	id: string
	sessionId: string
	project: string
	userPrompt: string
	assistantResponse: string
	timestamp: string
	messageIndex: number
}

// Stored in R2 as JSON
export interface ConversationIndex {
	exchanges: ConversationExchange[]
	lastUpdated: string
	sessionHashes: Record<string, string> // sessionId -> content hash for incremental updates
}

// Search result with time-weighted scoring
export interface ConversationSearchResult {
	exchange: ConversationExchange
	score: number
	adjustedScore: number
}

const CONVERSATION_INDEX_PATH = 'conversations/index.json'
const CONVERSATIONS_PREFIX = 'conversations/sessions/'
const MAX_STORED_EXCHANGES = 1_000
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const UNSAFE_SESSION_IDS = new Set(['__proto__', 'constructor', 'prototype'])

export function isSafeSessionId(value: string): boolean {
	return SESSION_ID_PATTERN.test(value) && !UNSAFE_SESSION_IDS.has(value)
}

/**
 * Parse a raw OpenCode session into exchanges
 */
export function parseOpenCodeSession(
	sessionId: string,
	project: string,
	sessionData: OpenCodeSession
): ConversationExchange[] {
	const exchanges: ConversationExchange[] = []
	const messages = sessionData.messages || []

	let currentUser: { content: string; timestamp: string; index: number } | null = null

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]

		if (msg.role === 'user' && typeof msg.content === 'string') {
			// Skip tool results and system context
			if (isToolResult(msg.content) || isSystemContext(msg.content)) {
				continue
			}
			currentUser = {
				content: extractUserText(msg.content),
				timestamp: msg.timestamp || sessionData.createdAt || new Date().toISOString(),
				index: i,
			}
		} else if (msg.role === 'assistant' && currentUser) {
			const assistantText = extractAssistantText(msg.content)
			if (currentUser.content && assistantText) {
				exchanges.push({
					id: `${sessionId}-${currentUser.index}`,
					sessionId,
					project,
					userPrompt: currentUser.content.slice(0, 2000),
					assistantResponse: assistantText.slice(0, 2000),
					timestamp: currentUser.timestamp,
					messageIndex: currentUser.index,
				})
			}
			currentUser = null
		}
	}

	return exchanges
}

/**
 * Check if content is a tool result (not a real user prompt)
 */
function isToolResult(content: string): boolean {
	return (
		content.includes('<tool_result>') ||
		content.includes('tool_use_id') ||
		content.startsWith('{"type":"tool_result"')
	)
}

/**
 * Check if content is system/context injection
 */
function isSystemContext(content: string): boolean {
	return (
		content.startsWith('<current_time>') ||
		content.startsWith('<system-reminder>') ||
		content.startsWith('# Agent Context') ||
		content.includes('<state_files>') ||
		content.includes('<context_status>') ||
		content.length < 5
	)
}

/**
 * Extract actual user text, stripping context wrappers
 */
function extractUserText(content: string): string {
	// Handle agent context blocks: "# Agent Context\n...\nUser message: <actual message>"
	if (content.includes('\nUser message: ')) {
		const match = content.match(/\nUser message: (.+)$/s)
		if (match) return match[1].trim()
	}
	return content.trim()
}

/**
 * Extract text from assistant response (may be array of content blocks)
 */
function extractAssistantText(content: string | AssistantContent[]): string {
	if (typeof content === 'string') {
		return content.slice(0, 1000)
	}

	// Array of content blocks - find first text block
	for (const block of content) {
		if (block.type === 'text' && block.text) {
			return block.text.slice(0, 1000)
		}
	}
	return ''
}

/**
 * Load or initialize the conversation index
 */
export async function loadConversationIndex(storage: R2Storage): Promise<ConversationIndex> {
	const file = await storage.read(CONVERSATION_INDEX_PATH)
	if (file) {
		try {
			const parsed = JSON.parse(file.content) as unknown
			if (!isConversationIndex(parsed)) throw new Error('invalid shape')
			return parsed
		} catch (error) {
			throw new Error(
				`Conversation index is corrupted: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}
	return {
		exchanges: [],
		lastUpdated: new Date().toISOString(),
		sessionHashes: Object.create(null) as Record<string, string>,
	}
}

/**
 * Save the conversation index
 */
export async function saveConversationIndex(
	storage: R2Storage,
	index: ConversationIndex
): Promise<void> {
	if (index.exchanges.length > MAX_STORED_EXCHANGES) {
		throw new Error(`Conversation index is limited to ${MAX_STORED_EXCHANGES} exchanges`)
	}
	index.lastUpdated = new Date().toISOString()
	await storage.write(CONVERSATION_INDEX_PATH, JSON.stringify(index, null, 2))
}

/**
 * Index a batch of sessions (called from sync script)
 */
export async function indexSessions(
	storage: R2Storage,
	sessions: Array<{ sessionId: string; project: string; data: OpenCodeSession }>
): Promise<{ added: number; updated: number; unchanged: number }> {
	const index = await loadConversationIndex(storage)
	let added = 0
	let updated = 0
	let unchanged = 0

	for (const { sessionId, project, data } of sessions) {
		if (!isSafeSessionId(sessionId)) throw new Error('Invalid conversation session ID')
		const sessionHash = await contentHash(JSON.stringify(data))
		const existingHash = index.sessionHashes[sessionId]

		if (existingHash === sessionHash) {
			unchanged++
			continue
		}

		// Remove old exchanges for this session
		const existingCount = index.exchanges.filter((e) => e.sessionId === sessionId).length
		index.exchanges = index.exchanges.filter((e) => e.sessionId !== sessionId)

		// Parse and add new exchanges
		const newExchanges = parseOpenCodeSession(sessionId, project, data)
		index.exchanges.push(...newExchanges)
		index.sessionHashes[sessionId] = sessionHash

		if (index.exchanges.length > MAX_STORED_EXCHANGES) {
			throw new Error(`Conversation index is limited to ${MAX_STORED_EXCHANGES} exchanges`)
		}

		// Also store the raw session data for expand_conversation.
		await storage.write(
			`${CONVERSATIONS_PREFIX}${sessionId}.json`,
			JSON.stringify({ project, data, indexedAt: new Date().toISOString() })
		)

		if (existingCount > 0) {
			updated++
		} else {
			added++
		}
	}

	await saveConversationIndex(storage, index)
	return { added, updated, unchanged }
}

/**
 * Get index stats
 */
export async function getConversationStats(
	storage: R2Storage
): Promise<{ exchangeCount: number; sessionCount: number; lastUpdated: string }> {
	const index = await loadConversationIndex(storage)
	return {
		exchangeCount: index.exchanges.length,
		sessionCount: Object.keys(index.sessionHashes).length,
		lastUpdated: index.lastUpdated,
	}
}

/**
 * Expand a conversation - get full session context
 */
export async function expandConversation(
	storage: R2Storage,
	sessionId: string,
	exchangeId?: string
): Promise<{
	project: string
	exchanges: ConversationExchange[]
	messages?: Array<{ role: string; content: string }>
	totalExchanges: number
	truncated?: boolean
} | null> {
	if (!isSafeSessionId(sessionId)) throw new Error('Invalid conversation session ID')
	// Try to load raw session data
	const sessionFile = await storage.read(`${CONVERSATIONS_PREFIX}${sessionId}.json`)
	if (!sessionFile) {
		// Fall back to index only
		const index = await loadConversationIndex(storage)
		const exchanges = index.exchanges.filter((e) => e.sessionId === sessionId)
		if (exchanges.length === 0) return null
		return {
			project: exchanges[0].project,
			exchanges: exchanges.slice(-20),
			totalExchanges: exchanges.length,
			truncated: exchanges.length > 20 || undefined,
		}
	}

	const stored = parseStoredSession(sessionFile.content)
	const { project, data } = stored
	const exchanges = parseOpenCodeSession(sessionId, project, data)

	// If exchangeId specified, return context around it
	if (exchangeId) {
		const targetIdx = exchanges.findIndex((e) => e.id === exchangeId)
		if (targetIdx >= 0) {
			const start = Math.max(0, targetIdx - 2)
			const end = Math.min(exchanges.length, targetIdx + 3)
			return {
				project,
				exchanges: exchanges.slice(start, end),
				totalExchanges: exchanges.length,
			}
		}
	}

	return {
		project,
		exchanges: exchanges.slice(-20),
		totalExchanges: exchanges.length,
		truncated: exchanges.length > 20 || undefined,
		messages: data.messages?.slice(-20).map((message) => ({
			role: message.role,
			content:
				typeof message.content === 'string' ? message.content.slice(0, 500) : '[complex content]',
		})),
	}
}

function isConversationIndex(value: unknown): value is ConversationIndex {
	if (!value || typeof value !== 'object') return false
	const candidate = value as Partial<ConversationIndex>
	return (
		Array.isArray(candidate.exchanges) &&
		candidate.exchanges.length <= MAX_STORED_EXCHANGES &&
		candidate.exchanges.every(isConversationExchange) &&
		typeof candidate.lastUpdated === 'string' &&
		Boolean(candidate.sessionHashes) &&
		typeof candidate.sessionHashes === 'object' &&
		Object.entries(candidate.sessionHashes).every(
			([sessionId, hash]) => isSafeSessionId(sessionId) && typeof hash === 'string'
		)
	)
}

function isConversationExchange(value: unknown): value is ConversationExchange {
	if (!value || typeof value !== 'object') return false
	const candidate = value as Partial<ConversationExchange>
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.sessionId === 'string' &&
		typeof candidate.project === 'string' &&
		typeof candidate.userPrompt === 'string' &&
		typeof candidate.assistantResponse === 'string' &&
		typeof candidate.timestamp === 'string' &&
		Number.isInteger(candidate.messageIndex)
	)
}

function parseStoredSession(content: string): { project: string; data: OpenCodeSession } {
	const parsed = JSON.parse(content) as unknown
	if (!parsed || typeof parsed !== 'object') throw new Error('Stored conversation is corrupted')
	const candidate = parsed as { project?: unknown; data?: unknown }
	if (typeof candidate.project !== 'string' || !isOpenCodeSession(candidate.data)) {
		throw new Error('Stored conversation is corrupted')
	}
	return { project: candidate.project, data: candidate.data }
}

export function isOpenCodeSession(value: unknown): value is OpenCodeSession {
	if (!value || typeof value !== 'object') return false
	const candidate = value as OpenCodeSession
	return (
		(candidate.messages === undefined ||
			(Array.isArray(candidate.messages) &&
				candidate.messages.length <= 2_000 &&
				candidate.messages.every(isOpenCodeMessage))) &&
		(candidate.createdAt === undefined || typeof candidate.createdAt === 'string')
	)
}

function isOpenCodeMessage(value: unknown): value is OpenCodeMessage {
	if (!value || typeof value !== 'object') return false
	const candidate = value as OpenCodeMessage
	return (
		['user', 'assistant', 'system'].includes(candidate.role) &&
		(typeof candidate.content === 'string' ||
			(Array.isArray(candidate.content) && candidate.content.every(isAssistantContent))) &&
		(candidate.timestamp === undefined || typeof candidate.timestamp === 'string')
	)
}

function isAssistantContent(value: unknown): value is AssistantContent {
	if (!value || typeof value !== 'object') return false
	const candidate = value as AssistantContent
	return (
		['text', 'tool_use', 'tool_result'].includes(candidate.type) &&
		(candidate.text === undefined || typeof candidate.text === 'string')
	)
}

// OpenCode session types (for parsing)
export interface OpenCodeMessage {
	role: 'user' | 'assistant' | 'system'
	content: string | AssistantContent[]
	timestamp?: string
}

export interface AssistantContent {
	type: 'text' | 'tool_use' | 'tool_result'
	text?: string
}

export interface OpenCodeSession {
	id?: string
	messages?: OpenCodeMessage[]
	createdAt?: string
	project?: string
}
