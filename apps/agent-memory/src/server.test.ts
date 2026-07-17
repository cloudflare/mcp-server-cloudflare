import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { registerMemoryTools } from './server'

import type { ZodRawShape } from 'zod'
import type { CloudflareMCPServer } from '@repo/mcp-common/src/server'
import type { Env } from './agent-memory.context'
import type { MemoryAgent } from './server'

function registeredSchemas() {
	const schemas = new Map<string, ZodRawShape>()
	const server = {
		accountTool(name: string, _description: string, shape: ZodRawShape) {
			schemas.set(name, shape)
		},
	} as unknown as CloudflareMCPServer
	registerMemoryTools({ server } as MemoryAgent, {} as Env)
	return schemas
}

describe('Agent Memory tool registration', () => {
	it('registers the curated managed-server tool surface', () => {
		const schemas = registeredSchemas()

		expect([...schemas.keys()]).toEqual([
			'read',
			'write',
			'write_many',
			'reindex',
			'list',
			'list_tags',
			'search',
			'get_backlinks',
			'search_conversations',
			'index_conversations',
			'expand_conversation',
			'conversation_stats',
			'schedule_reminder',
			'list_reminders',
			'remove_reminder',
			'check_reminders',
			'run_reflection',
			'list_pending_reflections',
			'apply_reflection_changes',
			'archive_reflection',
			'get_config',
			'set_config',
		])
	})

	it('blocks traversal and direct writes to managed internal state', () => {
		const schemas = registeredSchemas()
		const write = z.object(schemas.get('write')!)
		const read = z.object(schemas.get('read')!)

		expect(write.safeParse({ path: '../../bucket/object', content: 'bad' }).success).toBe(false)
		expect(write.safeParse({ path: '.mcp/config.json', content: 'bad' }).success).toBe(false)
		expect(
			write.safeParse({ path: 'memory/reflections/pending/fake.md', content: 'bad' }).success
		).toBe(false)
		expect(read.safeParse({ path: '.mcp/config.json' }).success).toBe(false)
		expect(read.safeParse({ path: 'memory/reflections/pending/2026-07-17.md' }).success).toBe(true)
		const writeMany = z.object(schemas.get('write_many')!)
		expect(
			writeMany.safeParse({
				files: [
					{ path: 'memory/same.md', content: 'first' },
					{ path: 'memory/same.md', content: 'second' },
				],
			}).success
		).toBe(false)
	})

	it('bounds and validates conversation sync batches', () => {
		const schema = z.object(registeredSchemas().get('index_conversations')!)
		const session = {
			sessionId: 'session-1',
			project: 'project',
			data: {
				messages: [
					{ role: 'user', content: 'Question' },
					{ role: 'assistant', content: 'Answer' },
				],
			},
		}

		expect(schema.safeParse({ sessions: [session] }).success).toBe(true)
		expect(schema.safeParse({ sessions: [session, session] }).success).toBe(false)
		expect(
			schema.safeParse({ sessions: [{ ...session, data: { messages: 'not-an-array' } }] }).success
		).toBe(false)
	})
})
