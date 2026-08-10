import { describeEval } from 'vitest-evals'

import { runTask } from '@repo/eval-tools/src/runTask'
import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient } from './utils'

eachModel('$modelName', ({ model }) => {
	describeEval('Runs container initialize', {
		data: async () => [
			{
				input: 'create and ping a container',
				expected:
					'The container_initialize tool was called and then the container_ping tool was called',
			},
		],
		task: async (input) => {
			const client = await initializeClient()
			const { promptOutput } = await runTask(client, model, input)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})
})
