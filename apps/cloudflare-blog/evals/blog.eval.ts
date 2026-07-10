import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { runTask } from '@repo/eval-tools/src/runTask'
import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { BLOG_TOOLS } from '../src/types/blog.types'

import { initializeClient } from './utils'

eachModel('$modelName', ({ model }) => {
	describeEval('Search Cloudflare Blog posts', {
		data: async () => [
			{
				input: 'Search the Cloudflare Blog for posts about Workers KV.',
				expected: `The ${BLOG_TOOLS.search_posts} tool should be called with a query related to Workers KV.`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === BLOG_TOOLS.search_posts)
			expect(toolCall, `Tool ${BLOG_TOOLS.search_posts} was not called`).toBeDefined()
			expect(toolCall?.input).toMatchObject({ query: expect.any(String) })
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('List Cloudflare Blog posts', {
		data: async () => [
			{
				input: 'List the latest posts on the Cloudflare Blog.',
				expected: `The ${BLOG_TOOLS.list_posts} tool should be called to retrieve recent blog posts.`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === BLOG_TOOLS.list_posts)
			expect(toolCall, `Tool ${BLOG_TOOLS.list_posts} was not called`).toBeDefined()
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('List Cloudflare Blog posts filtered by tag', {
		data: async () => [
			{
				input: 'List Cloudflare Blog posts tagged "workers".',
				expected: `The ${BLOG_TOOLS.list_posts} tool should be called with tag set to "workers".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === BLOG_TOOLS.list_posts)
			expect(toolCall, `Tool ${BLOG_TOOLS.list_posts} was not called`).toBeDefined()
			expect(toolCall?.input).toMatchObject({ tag: 'workers' })
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('Get a Cloudflare Blog post by slug', {
		data: async () => [
			{
				input: 'Get the Cloudflare Blog post with slug "workers-python-support".',
				expected: `The ${BLOG_TOOLS.get_post} tool should be called with slug set to "workers-python-support".`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === BLOG_TOOLS.get_post)
			expect(toolCall, `Tool ${BLOG_TOOLS.get_post} was not called`).toBeDefined()
			expect(toolCall?.input).toMatchObject({ slug: 'workers-python-support' })
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})

	describeEval('List Cloudflare Blog tags', {
		data: async () => [
			{
				input: 'What tags are available on the Cloudflare Blog?',
				expected: `The ${BLOG_TOOLS.list_tags} tool should be called to retrieve all available blog tags.`,
			},
		],
		task: async (input: string) => {
			const client = await initializeClient()
			const { promptOutput, toolCalls } = await runTask(client, model, input)
			const toolCall = toolCalls.find((call) => call.toolName === BLOG_TOOLS.list_tags)
			expect(toolCall, `Tool ${BLOG_TOOLS.list_tags} was not called`).toBeDefined()
			return promptOutput
		},
		scorers: [checkFactuality],
		threshold: 1,
		timeout: 60000,
	})
})
