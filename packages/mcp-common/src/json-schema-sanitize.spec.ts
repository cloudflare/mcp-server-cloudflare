import { describe, expect, it } from 'vitest'

import { stripNotEmptyJsonSchema } from './json-schema-sanitize'

describe('stripNotEmptyJsonSchema', () => {
	it('removes not:{} optional arms from anyOf', () => {
		const input = {
			properties: {
				hint: {
					anyOf: [{ not: {} }, { type: 'string', enum: ['wnam', 'enam'] }],
				},
			},
		}
		expect(stripNotEmptyJsonSchema(input)).toEqual({
			properties: {
				hint: { type: 'string', enum: ['wnam', 'enam'] },
			},
		})
	})

	it('leaves schemas without not:{} unchanged', () => {
		const input = {
			properties: {
				page: { type: 'number' },
			},
		}
		expect(stripNotEmptyJsonSchema(input)).toEqual(input)
	})
})
