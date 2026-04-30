import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchTypeDetails } from './graphql.tools'

describe('fetchTypeDetails', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('sends the type name as a GraphQL variable instead of interpolating it into the query', async () => {
		const maliciousTypeName = '") { name } } # injected'
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({
				data: {
					__type: {
						name: 'safe',
						kind: 'OBJECT',
						description: null,
						fields: [],
						inputFields: [],
						interfaces: [],
						enumValues: [],
						possibleTypes: [],
					},
				},
				errors: null,
			}),
			statusText: 'OK',
		} as Response)

		await fetchTypeDetails(maliciousTypeName, 'test-token')

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [, init] = fetchMock.mock.calls[0]
		const body = JSON.parse(String(init?.body))

		expect(body.query).toContain('query TypeDetails($typeName: String!)')
		expect(body.query).toContain('__type(name: $typeName)')
		expect(body.query).not.toContain(maliciousTypeName)
		expect(body.variables).toEqual({ typeName: maliciousTypeName })
	})
})
