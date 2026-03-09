import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { runTask } from '@repo/eval-tools/src/runTask'
import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient } from './utils' // Assuming utils.ts will exist here

eachModel('$modelName', ({ model }) => {
	describeEval('List Cloudflare Accounts', {
		data: async () => [
			{
				input: 'List all my Cloudflare accounts.',
				expected: 'The accounts_list tool should be called to retrieve the list of accounts.',
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)

			const toolCall = toolCalls.find((call) => call.toolName === 'accounts_list')
			expect(toolCall, 'Tool accounts_list was not called').toBeDefined()
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000, // 60 seconds
	})
})
