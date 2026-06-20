import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerGraphQLTools } from './graphql.tools'

import type { GraphQLMCP } from '../graphql.app'

type ToolResult = {
	content: Array<{
		type: string
		text: string
	}>
}

type ToolHandler = (params: {
	query: string
	variables?: Record<string, unknown>
}) => Promise<ToolResult>

type AccountToolHandler = (
	params: {
		query: string
		variables?: Record<string, unknown>
	},
	accountId: string
) => Promise<ToolResult>

function createGraphQLToolHandler() {
	const tools: Record<string, AccountToolHandler> = {}

	const agent = {
		props: {
			accessToken: 'test-api-token',
		},
		server: {
			accountTool: (
				name: string,
				_description: string,
				_schema: unknown,
				handler: AccountToolHandler
			) => {
				tools[name] = handler
			},
			registerTool: vi.fn(),
		},
	} as unknown as GraphQLMCP

	registerGraphQLTools(agent)

	return ((params) => tools.graphql_query(params, 'test-account-id')) satisfies ToolHandler
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('graphql_query', () => {
	it('returns GraphQL error responses that omit optional error metadata', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				return new Response(
					JSON.stringify({
						data: null,
						errors: [
							{
								message: 'not authorized for that account',
							},
						],
					}),
					{ status: 200 }
				)
			})
		)

		const graphqlQuery = createGraphQLToolHandler()
		const result = await graphqlQuery({
			query: 'query Viewer { viewer { accounts { id } } }',
		})

		expect(result.content[0]?.text).toContain('not authorized for that account')
		expect(result.content[0]?.text).not.toContain('invalid_type')
	})

	it('returns successful GraphQL responses that omit the errors field', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				return new Response(
					JSON.stringify({
						data: {
							viewer: {
								accounts: [{ id: 'test-account-id' }],
							},
						},
					}),
					{ status: 200 }
				)
			})
		)

		const graphqlQuery = createGraphQLToolHandler()
		const result = await graphqlQuery({
			query: 'query Viewer { viewer { accounts { id } } }',
		})

		expect(result.content[0]?.text).toContain('"test-account-id"')
		expect(result.content[0]?.text).not.toContain('Error executing GraphQL query')
	})

	it('returns GraphQL error responses with null path and custom extensions', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				return new Response(
					JSON.stringify({
						errors: [
							{
								message: 'Mutations are not supported',
								path: null,
								extensions: {
									classification: 'ValidationError',
								},
							},
						],
					}),
					{ status: 200 }
				)
			})
		)

		const graphqlQuery = createGraphQLToolHandler()
		const result = await graphqlQuery({
			query: 'mutation TestMutation { noop }',
		})

		expect(result.content[0]?.text).toContain('Mutations are not supported')
		expect(result.content[0]?.text).toContain('ValidationError')
		expect(result.content[0]?.text).not.toContain('invalid_union')
	})
})
