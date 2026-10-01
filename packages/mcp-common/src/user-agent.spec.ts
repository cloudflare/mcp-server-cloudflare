import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from './test/msw-server'
import { cloudflareFetch, getUserAgent, setUserAgentServer } from './user-agent'

const URL = 'https://api.cloudflare.com/client/v4/user'

/** Serve URL and record the headers of the request it receives. */
function captureHeaders(): { headers?: Headers } {
	const seen: { headers?: Headers } = {}
	server.use(
		http.all(URL, ({ request }) => {
			seen.headers = request.headers
			return HttpResponse.json({})
		})
	)
	return seen
}

describe('cloudflareFetch', () => {
	it('sets the User-Agent and keeps the caller headers', async () => {
		const seen = captureHeaders()

		await cloudflareFetch(URL, { headers: { Authorization: 'Bearer token' } })

		expect(seen.headers?.get('User-Agent')).toBe(getUserAgent())
		expect(seen.headers?.get('Authorization')).toBe('Bearer token')
	})

	it('overwrites a caller-supplied User-Agent', async () => {
		const seen = captureHeaders()

		await cloudflareFetch(URL, { headers: new Headers({ 'User-Agent': 'something-else' }) })

		expect(seen.headers?.get('User-Agent')).toBe(getUserAgent())
	})

	it("keeps a Request's own headers when no init headers are given", async () => {
		const seen = captureHeaders()

		await cloudflareFetch(new Request(URL, { headers: { Authorization: 'Bearer token' } }))

		expect(seen.headers?.get('User-Agent')).toBe(getUserAgent())
		expect(seen.headers?.get('Authorization')).toBe('Bearer token')
	})
})

describe('setUserAgentServer', () => {
	it('names the server in the User-Agent', async () => {
		setUserAgentServer('workers-bindings')
		const seen = captureHeaders()

		await cloudflareFetch(URL)

		expect(getUserAgent()).toBe('mcp-server-cloudflare/workers-bindings')
		expect(seen.headers?.get('User-Agent')).toBe('mcp-server-cloudflare/workers-bindings')
	})

	it.each(['', 'Workers Bindings', 'bindings/2', '-bindings'])('rejects %j', (serverId) => {
		expect(() => setUserAgentServer(serverId)).toThrow(TypeError)
	})
})
