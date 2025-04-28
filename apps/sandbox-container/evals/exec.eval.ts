import { assert, expect } from 'vitest'
import { describeEval } from 'vitest-evals'
import { z } from 'zod'

import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient, runTask } from './utils'

eachModel('$modelName', ({ model }) => {
	describeEval('Runs a python file in a container', {
		data: async () => [
			{
				input: 'Create a hello world python script and run it',
				expected: `The container_file_write tool was called, containing a file ending in .py.\
				Then the container_file_exec tool was called with python or python3 as one of the arguments`,
			},
		],
		task: async (input) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)

			expect(toolCalls).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'tool-call',
						toolName: 'container_exec',
						args: {
							args: expect.objectContaining({
								args: expect.stringContaining('python'),
							}),
						},
					}),
				])
			)

			expect(toolCalls).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'tool-call',
						toolName: 'container_file_write',
						args: {
							args: expect.objectContaining({
								path: expect.stringContaining('.py'),
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
