import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient, runTask } from './utils' // Assuming utils.ts will exist here

// Define a mock account ID for testing
const MOCK_ACCOUNT_ID = 'mock-account-12345'

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
	describeEval('Set Active Cloudflare Account', {
		data: async () => [
			{
				input: `Set my active Cloudflare account to ${MOCK_ACCOUNT_ID}.`,
				expected: `The set_active_account tool should be called with the account ID ${MOCK_ACCOUNT_ID}.`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === 'set_active_account')
			expect(toolCall, 'Tool set_active_account was not called').toBeDefined()

			expect(toolCall?.args, 'Arguments for set_active_account did not match').toEqual(
				expect.objectContaining({ activeAccountIdParam: MOCK_ACCOUNT_ID })
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000, // 60 seconds
	})
})
