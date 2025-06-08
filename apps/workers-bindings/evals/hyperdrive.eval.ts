import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { runTask } from '@repo/eval-tools/src/runTask'
import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'
import { HYPERDRIVE_TOOLS } from '@repo/mcp-common/src/tools/hyperdrive.tools'

import { initializeClient } from './utils' // Assuming utils.ts will exist here

// TODO: Add test for creating hyperdrive config with the following params once we can securely pass parameters to the tool. See: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/382
// const HYPERDRIVE_NAME = 'neon-test-hyperdrive'
// const HYPERDRIVE_DATABASE = 'neondb'
// const HYPERDRIVE_HOST = 'ep-late-cell-a4fm3g5p-pooler.us-east-1.aws.neon.tech'
// const HYPERDRIVE_PORT = 5432
// const HYPERDRIVE_USER = 'neondb_owner'
// const HYPERDRIVE_PASSWORD = 'my-test-password'

eachModel('$modelName', ({ model }) => {
	describeEval('Hyperdrive Tool Evaluations', {
		data: async () => [
			{
				input: `List my hyperdrive configurations.`,
				expected: `The ${HYPERDRIVE_TOOLS.hyperdrive_configs_list} tool should be called to list my hyperdrive configurations.`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient(/* Pass necessary mocks/config */)
			const { promptOutput, toolCalls } = await runTask(client, model, input)

			const toolCall = toolCalls.find(
				(call) => call.toolName === HYPERDRIVE_TOOLS.hyperdrive_configs_list
			)
			expect(
				toolCall,
				`Tool ${HYPERDRIVE_TOOLS.hyperdrive_configs_list} was not called`
			).toBeDefined()

			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})
})
