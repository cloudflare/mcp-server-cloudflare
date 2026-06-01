import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from './msw-server'

// Fail tests that make unmocked outbound requests (equivalent to the old
// `fetchMock.disableNetConnect()`), and reset handlers between tests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
