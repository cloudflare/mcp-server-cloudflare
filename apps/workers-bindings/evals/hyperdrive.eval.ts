import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient, runTask } from './utils' // Assuming utils.ts will exist here

const HYPERDRIVE_NAME = 'neon-test-hyperdrive'
const HYPERDRIVE_DATABASE = 'neondb'
const HYPERDRIVE_HOST = 'ep-late-cell-a4fm3g5p-pooler.us-east-1.aws.neon.tech'
const HYPERDRIVE_PORT = 5432
const HYPERDRIVE_USER = 'neondb_owner'
const HYPERDRIVE_PASSWORD = 'my-test-password'

eachModel('$modelName', ({ model }) => {
	describeEval('Hyperdrive Tool Evaluations', {
		data: async () => [
			{
				input: `Create a new Hyperdrive configuration with the name "${HYPERDRIVE_NAME}" and the database "${HYPERDRIVE_DATABASE}" and the host "${HYPERDRIVE_HOST}" and the port "${HYPERDRIVE_PORT}" and the user "${HYPERDRIVE_USER}" and the password "${HYPERDRIVE_PASSWORD}".`,
				expected:
					'The hyperdrive_configs_create tool should be called to create a new hyperdrive configuration.',
			},
		],
		task: async (input: string) => {
			const client = await initializeClient(/* Pass necessary mocks/config */)
			const { promptOutput, toolCalls } = await runTask(client, model, input)

			const toolCall = toolCalls.find((call) => call.toolName === 'hyperdrive_config_create')
			expect(toolCall, 'Tool hyperdrive_configs_create was not called').toBeDefined()

			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000, // 60 seconds
	})
})
