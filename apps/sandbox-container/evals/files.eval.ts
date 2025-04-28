import { assert, expect } from 'vitest'
import { describeEval } from 'vitest-evals'
import { z } from 'zod'

import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient, runTask } from './utils'

eachModel('$modelName', ({ model }) => {
	describeEval('Runs container file write', {
		data: async () => [
			{
				input: 'write a file named test.txt containing the text "asdf"',
				expected: 'The container_file_write tool was called and the file\'s content is "asdf"',
			},
		],
		task: async (input) => {
			const client = await initializeClient()
			const { promptOutput } = await runTask(client, model, input)
			const fileRead = client.listTools().find((tool) => {
				if (tool.name === 'container_file_read') {
					return tool
				}
			})

			assert(fileRead !== undefined)
			const result = await client.callTool(
				{
					...fileRead,
					arguments: {
						args: { path: 'file://test.txt' },
					},
				},
				z.any() as any,
				{}
			)

			expect(result.content).toStrictEqual([
				{
					type: 'resource',
					resource: {
						uri: 'file://test.txt',
						mimeType: 'text/plain',
						text: 'asdf',
					},
				},
			])

			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('Runs container file delete', {
		data: async () => [
			{
				input: 'write a file named test.txt, then delete it',
				expected:
					'The container_file_write tool was called and then the container_file_delete tool was called with the same parameters',
			},
		],
		task: async (input) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)

			const toolArgs = toolCalls.find((tool) => {
				return tool.toolName === 'container_file_write' ? tool : undefined
			})?.args as { args: { path: string } } | undefined

			assert(toolArgs !== undefined)
			expect(toolCalls).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'tool-call',
						toolName: 'container_file_write',
						args: {
							args: expect.objectContaining({
								path: toolArgs.args.path,
							}),
						},
					}),
				])
			)

			expect(toolCalls).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'tool-call',
						toolName: 'container_file_delete',
						args: {
							args: expect.objectContaining({
								path: toolArgs.args.path,
							}),
						},
					}),
				])
			)

			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})
})
