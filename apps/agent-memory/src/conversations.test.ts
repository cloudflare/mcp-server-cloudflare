import { beforeEach, describe, expect, it } from 'vitest'

import {
	expandConversation,
	getConversationStats,
	indexSessions,
	loadConversationIndex,
	parseOpenCodeSession,
	saveConversationIndex,
} from './conversations'
import { createMockStorage } from './test/mock-storage'

describe('parseOpenCodeSession', () => {
	it('should parse simple user-assistant exchanges', () => {
		const sessionData = {
			id: 'test-session',
			createdAt: '2026-01-31T10:00:00Z',
			messages: [
				{
					role: 'user' as const,
					content: 'How do I create a Worker?',
					timestamp: '2026-01-31T10:00:00Z',
				},
				{
					role: 'assistant' as const,
					content: 'You can create a Worker using wrangler init.',
					timestamp: '2026-01-31T10:00:01Z',
				},
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'my-project', sessionData)

		expect(exchanges).toHaveLength(1)
		expect(exchanges[0].sessionId).toBe('session-1')
		expect(exchanges[0].project).toBe('my-project')
		expect(exchanges[0].userPrompt).toBe('How do I create a Worker?')
		expect(exchanges[0].assistantResponse).toContain('wrangler init')
	})

	it('should parse multiple exchanges in a session', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: 'First question' },
				{ role: 'assistant' as const, content: 'First answer' },
				{ role: 'user' as const, content: 'Second question' },
				{ role: 'assistant' as const, content: 'Second answer' },
				{ role: 'user' as const, content: 'Third question' },
				{ role: 'assistant' as const, content: 'Third answer' },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges).toHaveLength(3)
		expect(exchanges[0].userPrompt).toBe('First question')
		expect(exchanges[1].userPrompt).toBe('Second question')
		expect(exchanges[2].userPrompt).toBe('Third question')
	})

	it('should skip tool result messages', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: 'Run the build' },
				{ role: 'assistant' as const, content: 'Running build...' },
				{ role: 'user' as const, content: '<tool_result>Build successful</tool_result>' },
				{ role: 'assistant' as const, content: 'Build completed successfully!' },
				{ role: 'user' as const, content: 'Thanks!' },
				{ role: 'assistant' as const, content: "You're welcome!" },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		// Should only have 2 exchanges: "Run the build" and "Thanks!"
		// The tool_result message should be skipped
		expect(exchanges).toHaveLength(2)
		expect(exchanges[0].userPrompt).toBe('Run the build')
		expect(exchanges[1].userPrompt).toBe('Thanks!')
	})

	it('should skip system context messages', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: '<current_time>2026-01-31</current_time>' },
				{ role: 'user' as const, content: 'Hello!' },
				{ role: 'assistant' as const, content: 'Hi there!' },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges).toHaveLength(1)
		expect(exchanges[0].userPrompt).toBe('Hello!')
	})

	it('should skip very short messages', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: 'ok' }, // 2 chars, skipped
				{ role: 'assistant' as const, content: 'Sure!' },
				{ role: 'user' as const, content: 'What is TypeScript?' },
				{ role: 'assistant' as const, content: 'TypeScript is a typed superset of JavaScript.' },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges).toHaveLength(1)
		expect(exchanges[0].userPrompt).toBe('What is TypeScript?')
	})

	it('should extract user message from agent context wrapper', () => {
		// Note: Messages starting with "# Agent Context" are filtered as system context.
		// The extractUserText function only runs for messages that pass isSystemContext.
		// In practice, the context wrapper might be in a different format or
		// we need messages that don't start with "# Agent Context" but contain "User message:"
		const sessionData = {
			messages: [
				{
					role: 'user' as const,
					content: 'Some preamble context here...\nUser message: What is KV?',
				},
				{ role: 'assistant' as const, content: 'KV is a key-value store.' },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges).toHaveLength(1)
		expect(exchanges[0].userPrompt).toBe('What is KV?')
	})

	it('should handle assistant content as array of blocks', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: 'Show me code' },
				{
					role: 'assistant' as const,
					content: [
						{ type: 'text' as const, text: 'Here is the code:' },
						{ type: 'tool_use' as const },
					],
				},
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges).toHaveLength(1)
		expect(exchanges[0].assistantResponse).toBe('Here is the code:')
	})

	it('should truncate long prompts and responses', () => {
		const longPrompt = 'a'.repeat(3000)
		const longResponse = 'b'.repeat(3000)

		const sessionData = {
			messages: [
				{ role: 'user' as const, content: longPrompt },
				{ role: 'assistant' as const, content: longResponse },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges[0].userPrompt.length).toBeLessThanOrEqual(2000)
		expect(exchanges[0].assistantResponse.length).toBeLessThanOrEqual(2000)
	})

	it('should handle empty session', () => {
		const sessionData = { messages: [] }
		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)
		expect(exchanges).toHaveLength(0)
	})

	it('should handle session with only user messages (no assistant response)', () => {
		const sessionData = {
			messages: [{ role: 'user' as const, content: 'Question without answer' }],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)
		expect(exchanges).toHaveLength(0)
	})

	it('should generate unique exchange IDs', () => {
		const sessionData = {
			messages: [
				{ role: 'user' as const, content: 'First' },
				{ role: 'assistant' as const, content: 'Response 1' },
				{ role: 'user' as const, content: 'Second' },
				{ role: 'assistant' as const, content: 'Response 2' },
			],
		}

		const exchanges = parseOpenCodeSession('session-1', 'project', sessionData)

		expect(exchanges[0].id).toBe('session-1-0')
		expect(exchanges[1].id).toBe('session-1-2')
	})
})

describe('conversation index operations', () => {
	let storage: ReturnType<typeof createMockStorage>

	beforeEach(() => {
		storage = createMockStorage()
	})

	describe('loadConversationIndex', () => {
		it('should return empty index when none exists', async () => {
			const index = await loadConversationIndex(storage)

			expect(index.exchanges).toHaveLength(0)
			expect(Object.keys(index.sessionHashes)).toHaveLength(0)
		})

		it('should load existing index', async () => {
			const existingIndex = {
				exchanges: [
					{
						id: 's1-0',
						sessionId: 's1',
						project: 'proj',
						userPrompt: 'test',
						assistantResponse: 'response',
						timestamp: '2026-01-31T10:00:00Z',
						messageIndex: 0,
					},
				],
				lastUpdated: '2026-01-31T10:00:00Z',
				sessionHashes: { s1: 'abc123' },
			}
			await storage.write('conversations/index.json', JSON.stringify(existingIndex))

			const index = await loadConversationIndex(storage)

			expect(index.exchanges).toHaveLength(1)
			expect(index.sessionHashes.s1).toBe('abc123')
		})

		it('should refuse to overwrite a corrupted index', async () => {
			await storage.write('conversations/index.json', 'not valid json')

			await expect(loadConversationIndex(storage)).rejects.toThrow(/corrupted/)
		})
	})

	describe('saveConversationIndex', () => {
		it('should save index with updated timestamp', async () => {
			const index = {
				exchanges: [],
				lastUpdated: '2026-01-30T10:00:00Z',
				sessionHashes: {},
			}

			await saveConversationIndex(storage, index)

			const saved = await storage.read('conversations/index.json')
			expect(saved).not.toBeNull()

			const parsed = JSON.parse(saved!.content)
			expect(parsed.lastUpdated).not.toBe('2026-01-30T10:00:00Z')
		})
	})

	describe('indexSessions', () => {
		it('should add new sessions', async () => {
			const sessions = [
				{
					sessionId: 'session-1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Hello' },
							{ role: 'assistant' as const, content: 'Hi!' },
						],
					},
				},
			]

			const result = await indexSessions(storage, sessions)

			expect(result.added).toBe(1)
			expect(result.updated).toBe(0)
			expect(result.unchanged).toBe(0)

			const index = await loadConversationIndex(storage)
			expect(index.exchanges).toHaveLength(1)
		})

		it('should skip unchanged sessions', async () => {
			const sessions = [
				{
					sessionId: 'session-1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Hello' },
							{ role: 'assistant' as const, content: 'Hi!' },
						],
					},
				},
			]

			// Index once
			await indexSessions(storage, sessions)

			// Index again with same content
			const result = await indexSessions(storage, sessions)

			expect(result.added).toBe(0)
			expect(result.updated).toBe(0)
			expect(result.unchanged).toBe(1)
		})

		it('should update changed sessions', async () => {
			const sessions = [
				{
					sessionId: 'session-1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Hello' },
							{ role: 'assistant' as const, content: 'Hi!' },
						],
					},
				},
			]

			// Index once
			await indexSessions(storage, sessions)

			// Index again with modified content
			sessions[0].data.messages.push(
				{ role: 'user' as const, content: 'How are you?' },
				{ role: 'assistant' as const, content: "I'm good!" }
			)

			const result = await indexSessions(storage, sessions)

			expect(result.added).toBe(0)
			expect(result.updated).toBe(1)
			expect(result.unchanged).toBe(0)

			const index = await loadConversationIndex(storage)
			expect(index.exchanges).toHaveLength(2)
		})

		it('should store raw session data for expansion', async () => {
			const sessions = [
				{
					sessionId: 'session-1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Test' },
							{ role: 'assistant' as const, content: 'Response' },
						],
					},
				},
			]

			await indexSessions(storage, sessions)

			const rawSession = await storage.read('conversations/sessions/session-1.json')
			expect(rawSession).not.toBeNull()
			expect(JSON.parse(rawSession!.content).project).toBe('my-project')
		})
	})

	describe('getConversationStats', () => {
		it('should return stats for empty index', async () => {
			const stats = await getConversationStats(storage)

			expect(stats.exchangeCount).toBe(0)
			expect(stats.sessionCount).toBe(0)
		})

		it('should return correct counts', async () => {
			// Note: prompts < 5 chars are filtered out, so use longer prompts
			const sessions = [
				{
					sessionId: 's1',
					project: 'p1',
					data: {
						messages: [
							{ role: 'user' as const, content: 'First question about Workers' },
							{ role: 'assistant' as const, content: 'First answer' },
							{ role: 'user' as const, content: 'Second question about KV' },
							{ role: 'assistant' as const, content: 'Second answer' },
						],
					},
				},
				{
					sessionId: 's2',
					project: 'p1',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Third question about R2' },
							{ role: 'assistant' as const, content: 'Third answer' },
						],
					},
				},
			]

			await indexSessions(storage, sessions)
			const stats = await getConversationStats(storage)

			expect(stats.exchangeCount).toBe(3)
			expect(stats.sessionCount).toBe(2)
		})
	})

	describe('expandConversation', () => {
		it('should return null for unknown session', async () => {
			const result = await expandConversation(storage, 'unknown-session')
			expect(result).toBeNull()
		})

		it('should return exchanges for known session', async () => {
			const sessions = [
				{
					sessionId: 's1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Question' },
							{ role: 'assistant' as const, content: 'Answer' },
						],
					},
				},
			]

			await indexSessions(storage, sessions)
			const result = await expandConversation(storage, 's1')

			expect(result).not.toBeNull()
			expect(result!.project).toBe('my-project')
			expect(result!.exchanges).toHaveLength(1)
		})

		it('should return context around specific exchange', async () => {
			const sessions = [
				{
					sessionId: 's1',
					project: 'my-project',
					data: {
						messages: [
							{ role: 'user' as const, content: 'Q1' },
							{ role: 'assistant' as const, content: 'A1' },
							{ role: 'user' as const, content: 'Q2' },
							{ role: 'assistant' as const, content: 'A2' },
							{ role: 'user' as const, content: 'Q3' },
							{ role: 'assistant' as const, content: 'A3' },
							{ role: 'user' as const, content: 'Q4' },
							{ role: 'assistant' as const, content: 'A4' },
							{ role: 'user' as const, content: 'Q5' },
							{ role: 'assistant' as const, content: 'A5' },
						],
					},
				},
			]

			await indexSessions(storage, sessions)
			const result = await expandConversation(storage, 's1', 's1-4') // Q3 (index 4)

			expect(result).not.toBeNull()
			// Should return 5 exchanges around the target (2 before, target, 2 after)
			expect(result!.exchanges.length).toBeLessThanOrEqual(5)
		})

		it('should fall back to index when raw session unavailable', async () => {
			// Manually create an index without raw session data
			const index = {
				exchanges: [
					{
						id: 's1-0',
						sessionId: 's1',
						project: 'proj',
						userPrompt: 'test',
						assistantResponse: 'response',
						timestamp: '2026-01-31T10:00:00Z',
						messageIndex: 0,
					},
				],
				lastUpdated: '2026-01-31T10:00:00Z',
				sessionHashes: { s1: 'abc123' },
			}
			await storage.write('conversations/index.json', JSON.stringify(index))

			const result = await expandConversation(storage, 's1')

			expect(result).not.toBeNull()
			expect(result!.exchanges).toHaveLength(1)
			expect(result!.messages).toBeUndefined()
		})
	})
})
