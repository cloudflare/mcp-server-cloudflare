import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { runTask } from '@repo/eval-tools/src/runTask'
import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'
import { VECTORIZE_TOOLS } from '@repo/mcp-common/src/tools/vectorize'

import { initializeClient } from './utils' // Assuming utils.ts will exist here

const MOCK_INDEX_NAME = 'test-vectorize-index'
const MOCK_INDEX_DESCRIPTION = 'A test index for evaluation'
const MOCK_DIMENSIONS = 32
const MOCK_METRIC = 'cosine'
const MOCK_PRESET = '@cf/baai/bge-small-en-v1.5'

eachModel('$modelName', ({ model }) => {
	describeEval('Create Vectorize Index (Dimensions/Metric)', {
		data: async () => [
			{
				input: `Create a Vectorize index named "${MOCK_INDEX_NAME}" with ${MOCK_DIMENSIONS} dimensions using the "${MOCK_METRIC}" metric. Add description: "${MOCK_INDEX_DESCRIPTION}".`,
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_create} tool should be called with name "${MOCK_INDEX_NAME}", config specifying ${MOCK_DIMENSIONS} dimensions and "${MOCK_METRIC}" metric, and description "${MOCK_INDEX_DESCRIPTION}".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_create
			)
			expect(toolCall, 'Tool vectorize_index_create was not called').toBeDefined()
			expect(toolCall?.args, 'Arguments did not match').toEqual(
				expect.objectContaining({
					name: MOCK_INDEX_NAME,
					config: expect.objectContaining({
						dimensions: MOCK_DIMENSIONS,
						metric: MOCK_METRIC,
					}),
					description: MOCK_INDEX_DESCRIPTION,
				})
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	// --- Test vectorize_index_create (with preset) ---
	describeEval('Create Vectorize Index (Preset)', {
		data: async () => [
			{
				input: `Create a Vectorize index named "${MOCK_INDEX_NAME}-preset" using the "${MOCK_PRESET}" preset.`,
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_create} tool should be called with name "${MOCK_INDEX_NAME}-preset" and config specifying the preset "${MOCK_PRESET}".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_create
			)
			expect(toolCall, 'Tool vectorize_index_create was not called').toBeDefined()
			expect(toolCall?.args, 'Arguments did not match').toEqual(
				expect.objectContaining({
					name: `${MOCK_INDEX_NAME}-preset`,
					config: expect.objectContaining({
						preset: MOCK_PRESET,
					}),
				})
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	// --- Test vectorize_index_list ---
	describeEval('List Vectorize Indexes', {
		data: async () => [
			{
				input: 'List my Vectorize indexes.',
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_list} tool should be called.`,
			},
			{
				input: 'Show me page 2 of my Vectorize indexes, 10 per page, ordered by name descending.',
				expected:
					'The ${VECTORIZE_TOOLS.vectorize_index_list} tool should be called with page 2, per_page 10, order name, direction desc.',
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_list
			)
			expect(toolCall, 'Tool vectorize_index_list was not called').toBeDefined()

			// Check specific args only for the pagination case
			if (input.includes('page 2')) {
				expect(toolCall?.args, 'Pagination arguments did not match').toEqual(
					expect.objectContaining({
						page: 2,
						per_page: 10,
						order: 'name',
						direction: 'desc',
					})
				)
			}

			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	// --- Test vectorize_index_get ---
	describeEval('Get Vectorize Index Details', {
		data: async () => [
			{
				input: `Get the details for the Vectorize index named "${MOCK_INDEX_NAME}".`,
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_get} tool should be called with name "${MOCK_INDEX_NAME}".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_get
			)
			expect(toolCall, 'Tool vectorize_index_get was not called').toBeDefined()
			expect(toolCall?.args, 'Arguments did not match').toEqual(
				expect.objectContaining({
					name: MOCK_INDEX_NAME,
				})
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('Get Vectorize Index Info', {
		data: async () => [
			{
				input: `Get operational info for the Vectorize index "${MOCK_INDEX_NAME}".`,
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_info} tool should be called with name "${MOCK_INDEX_NAME}".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_info
			)
			expect(toolCall, 'Tool vectorize_index_info was not called').toBeDefined()
			expect(toolCall?.args, 'Arguments did not match').toEqual(
				expect.objectContaining({
					name: MOCK_INDEX_NAME,
				})
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('Delete Vectorize Index', {
		data: async () => [
			{
				input: `Delete the Vectorize index named "${MOCK_INDEX_NAME}".`,
				expected: `The ${VECTORIZE_TOOLS.vectorize_index_delete} tool should be called with name "${MOCK_INDEX_NAME}".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find(
				(call) => call.toolName === VECTORIZE_TOOLS.vectorize_index_delete
			)
			expect(toolCall, 'Tool vectorize_index_delete was not called').toBeDefined()
			expect(toolCall?.args, 'Arguments did not match').toEqual(
				expect.objectContaining({
					name: MOCK_INDEX_NAME,
				})
			)
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})
})
