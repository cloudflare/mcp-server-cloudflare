import { setupServer } from 'msw/node'

/**
 * Shared MSW server for mocking outbound HTTP in tests. Replaces the `fetchMock` export that
 * `cloudflare:test` removed in @cloudflare/vitest-pool-workers v0.16. Tests add handlers with
 * `server.use(http.<method>(url, () => HttpResponse.json(...)))`.
 */
export const server = setupServer()
