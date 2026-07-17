import { describe, expect, it, vi } from 'vitest'

import { WorkersAIProvider } from './workers-ai'

import type { AiRunner } from '../ai/runner'
import type { LLMMessage } from './types'

function toolResponse(id = 'call-123') {
	return {
		id: 'completion-1',
		object: 'chat.completion',
		created: 1,
		model: '@cf/zai-org/glm-4.7-flash',
		choices: [
			{
				index: 0,
				message: {
					role: 'assistant',
					content: null,
					tool_calls: [
						{
							id,
							type: 'function',
							function: { name: 'readFile', arguments: '{"path":"memory/a.md"}' },
						},
					],
				},
				finish_reason: 'tool_calls',
			},
		],
	}
}

describe('WorkersAIProvider tool calling', () => {
	it('preserves upstream tool call IDs', async () => {
		const ai = { run: vi.fn().mockResolvedValue(toolResponse()) } satisfies AiRunner
		const provider = new WorkersAIProvider(ai)

		const result = await provider.complete('read the file')

		expect(result.toolCalls).toEqual([
			{ id: 'call-123', name: 'readFile', arguments: { path: 'memory/a.md' } },
		])
	})

	it('serializes assistant tool calls and matching tool results on the next turn', async () => {
		const ai = { run: vi.fn().mockResolvedValue(toolResponse('call-next')) } satisfies AiRunner
		const provider = new WorkersAIProvider(ai)
		const messages: LLMMessage[] = [
			{ role: 'user', content: 'read the file' },
			{
				role: 'assistant',
				content: '',
				tool_calls: [{ id: 'call-123', name: 'readFile', arguments: { path: 'memory/a.md' } }],
			},
			{ role: 'tool', content: '{"content":"hello"}', tool_call_id: 'call-123' },
		]

		await provider.complete(messages)

		expect(ai.run).toHaveBeenCalledWith(
			'@cf/qwen/qwq-32b',
			expect.objectContaining({
				messages: [
					{ role: 'user', content: 'read the file' },
					{
						role: 'assistant',
						content: '',
						tool_calls: [
							{
								id: 'call-123',
								type: 'function',
								function: {
									name: 'readFile',
									arguments: '{"path":"memory/a.md"}',
								},
							},
						],
					},
					{ role: 'tool', content: '{"content":"hello"}', tool_call_id: 'call-123' },
				],
			})
		)
	})
})
