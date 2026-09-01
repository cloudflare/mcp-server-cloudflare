const API_BASE_URL = 'https://api.cloudflare.com/client/v4'

const LIST_ENDPOINTS = {
	zones_list: (accountId) => `/zones?account.id=${encodeURIComponent(accountId)}&per_page=50`,
	domain_list: (accountId) => `/accounts/${encodeURIComponent(accountId)}/workers/domains`,
	worker_list: (accountId) => `/accounts/${encodeURIComponent(accountId)}/workers/scripts`,
}

/**
 * Converts response envelopes used by some 0.2.0 handlers into an MCP CallToolResult.
 */
export function normalizeLegacyResponse(message) {
	if (!isObject(message) || !isObject(message.result)) return message

	const legacyResult = message.result
	const result = isObject(legacyResult.toolResult) ? legacyResult.toolResult : legacyResult
	if (!Array.isArray(result.content)) return message

	const { metadata: _metadata, ...normalizedResult } = result
	return { ...message, result: normalizedResult }
}

/**
 * Handles list calls whose 0.2.0 implementations returned malformed envelopes.
 * Returns undefined when the request should be delegated to the legacy server.
 */
export async function handleListRequest(
	request,
	{ accountId, apiToken, fetchImpl = globalThis.fetch }
) {
	if (
		!isObject(request) ||
		request.method !== 'tools/call' ||
		!isObject(request.params) ||
		typeof request.params.name !== 'string' ||
		!(request.params.name in LIST_ENDPOINTS) ||
		typeof accountId !== 'string' ||
		!accountId ||
		typeof apiToken !== 'string' ||
		!apiToken
	) {
		return undefined
	}

	try {
		const endpoint = LIST_ENDPOINTS[request.params.name](accountId)
		const response = await fetchImpl(`${API_BASE_URL}${endpoint}`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		})
		const data = await response.json()

		if (!response.ok || !isObject(data) || data.success === false) {
			throw new Error(getApiError(data, response.status))
		}

		return createJsonRpcResponse(request.id, {
			content: [
				{
					type: 'text',
					text: JSON.stringify(data.result, null, 2),
				},
			],
		})
	} catch (error) {
		return createJsonRpcResponse(request.id, {
			content: [
				{
					type: 'text',
					text: `Error: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		})
	}
}

export function getAccountId(argv, env) {
	return argv[0] === 'run' ? argv[1] || env.CLOUDFLARE_ACCOUNT_ID : env.CLOUDFLARE_ACCOUNT_ID
}

function createJsonRpcResponse(id, result) {
	return { jsonrpc: '2.0', id, result }
}

function getApiError(data, status) {
	if (isObject(data) && Array.isArray(data.errors)) {
		const messages = data.errors
			.map((error) => (isObject(error) && typeof error.message === 'string' ? error.message : ''))
			.filter(Boolean)
		if (messages.length > 0) return messages.join('; ')
	}
	return `Cloudflare API request failed with status ${status}`
}

function isObject(value) {
	return typeof value === 'object' && value !== null
}
