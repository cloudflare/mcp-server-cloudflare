/**
 * Remove zod-to-json-schema optional arms like `{ "not": {} }` that break strict
 * LLM function-calling validators (Kimi, Gemini, OpenAI strict mode).
 */
export function stripNotEmptyJsonSchema<T>(node: T): T {
	if (Array.isArray(node)) {
		return node.map((item) => stripNotEmptyJsonSchema(item)) as T
	}
	if (node === null || typeof node !== 'object') {
		return node
	}

	const obj = { ...(node as Record<string, unknown>) }

	if (Array.isArray(obj.anyOf)) {
		const kept = obj.anyOf.filter((member) => !isNotEmptySchema(member))
		if (kept.length === 1) {
			const inlined = stripNotEmptyJsonSchema(kept[0]) as Record<string, unknown>
			const { anyOf: _removed, ...rest } = obj
			return { ...inlined, ...rest } as T
		}
		obj.anyOf = kept.map((member) => stripNotEmptyJsonSchema(member))
	}

	for (const key of Object.keys(obj)) {
		if (key === 'anyOf') continue
		obj[key] = stripNotEmptyJsonSchema(obj[key])
	}

	return obj as T
}

function isNotEmptySchema(member: unknown): boolean {
	if (!member || typeof member !== 'object') return false
	const notValue = (member as Record<string, unknown>).not
	return (
		Object.keys(member as object).length === 1 &&
		notValue !== null &&
		typeof notValue === 'object' &&
		Object.keys(notValue as object).length === 0
	)
}
