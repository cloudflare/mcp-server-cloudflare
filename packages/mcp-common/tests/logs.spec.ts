import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { handleWorkerLogs, handleWorkerLogsKeys } from '../src/api/logs'

beforeAll(() => {
	// Enable outbound request mocking...
	fetchMock.activate()
	// ...and throw errors if an outbound request isn't mocked
	fetchMock.disableNetConnect()
})

// Ensure we matched every mock we defined
afterEach(() => fetchMock.assertNoPendingInterceptors())

describe('Logs API', () => {
	describe('handleWorkerLogs', () => {
		it('should fetch and analyze worker logs correctly', async () => {
			const scriptName = 'test-worker'

			// Create mock log events
			const mockEvents = [
				{
					timestamp: Date.now() - 100000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'ok',
						eventType: 'fetch',
						requestId: '123456abcdef',
						wallTimeMs: 45.2,
						cpuTimeMs: 12.8,
						event: {
							request: {
								method: 'GET',
								path: '/api/v1/resource',
								url: 'https://example.com/api/v1/resource',
							},
							response: {
								status: 200,
							},
							rayId: 'ray123abc456def',
						},
					},
					source: {
						message: 'Successful request to resource',
					},
					dataset: 'cloudflare-workers',
					$metadata: {
						id: '1',
						message: 'GET /api/v1/resource',
					},
				},
				{
					timestamp: Date.now() - 200000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'ok',
						eventType: 'fetch',
						requestId: '456789bcdef01',
						wallTimeMs: 88.7,
						cpuTimeMs: 33.2,
						event: {
							request: {
								method: 'POST',
								path: '/api/v1/resource/create',
								url: 'https://example.com/api/v1/resource/create',
							},
							response: {
								status: 201,
							},
							rayId: 'ray456def789ghi',
						},
					},
					source: {
						message: 'Created new resource',
					},
					dataset: 'cloudflare-workers',
					$metadata: {
						id: '2',
						message: 'POST /api/v1/resource/create',
					},
				},
				{
					timestamp: Date.now() - 300000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'error',
						eventType: 'fetch',
						requestId: '789012defghi34',
						wallTimeMs: 112.3,
						cpuTimeMs: 45.8,
						event: {
							request: {
								method: 'PUT',
								path: '/api/v1/resource/update',
								url: 'https://example.com/api/v1/resource/update',
							},
							rayId: 'ray789ghi012jkl',
						},
					},
					source: {
						message: 'Resource not found',
					},
					dataset: 'cloudflare-workers',
					$metadata: {
						id: '3',
						message: 'Error updating resource',
					},
				},
			]

			const mockResponse = {
				success: true,
				result: {
					events: {
						events: mockEvents,
					},
				},
				errors: [],
				messages: [{ message: 'Successful request' }],
			}

			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/query`,
				})
				.reply(200, mockResponse)

			const limit = 100
			const minutesAgo = 30
			const result = await handleWorkerLogs({
				scriptName,
				limit,
				minutesAgo,
				accountId: env.CLOUDFLARE_MOCK_ACCOUNT_ID,
				apiToken: env.CLOUDFLARE_MOCK_API_TOKEN,
				shouldFilterErrors: false,
			})

			// Verify that the timestamp range is set correctly
			expect(result).toHaveProperty('from')
			expect(result).toHaveProperty('to')
			expect(result.from).toBeLessThan(result.to)

			// Verify that we have relevant logs that match our mock data
			expect(result.relevantLogs).toHaveLength(3)

			const getLog = result.relevantLogs[0]
			expect(getLog.method).toBe(mockEvents[0].$workers.event.request.method)
			expect(getLog.path).toBe(mockEvents[0].$workers.event.request.path)
			expect(getLog.status).toBe(mockEvents[0].$workers.event.response?.status)
			expect(getLog.outcome).toBe(mockEvents[0].$workers.outcome)
			expect(getLog.rayId).toBe(mockEvents[0].$workers.event.rayId)
			expect(getLog.duration).toBeGreaterThan(0)

			const postLog = result.relevantLogs[1]
			expect(postLog.method).toBe(mockEvents[1].$workers.event.request.method)
			expect(postLog.path).toBe(mockEvents[1].$workers.event.request.path)
			expect(postLog.status).toBe(mockEvents[1].$workers.event.response?.status)
			expect(postLog.outcome).toBe(mockEvents[1].$workers.outcome)
			expect(postLog.rayId).toBe(mockEvents[1].$workers.event.rayId)

			const errorLog = result.relevantLogs[2]
			expect(errorLog.method).toBe(mockEvents[2].$workers.event.request.method)
			expect(errorLog.path).toBe(mockEvents[2].$workers.event.request.path)
			expect(errorLog.outcome).toBe(mockEvents[2].$workers.outcome)
			expect(errorLog.rayId).toBe(mockEvents[2].$workers.event.rayId)
		})

		it('should handle empty logs', async () => {
			const scriptName = 'empty-worker'

			const mockResponse = {
				success: true,
				result: {
					events: {
						events: [],
					},
				},
				errors: [],
				messages: [{ message: 'Successful request' }],
			}

			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/query`,
				})
				.reply(200, mockResponse)

			const limit = 100
			const minutesAgo = 30
			const result = await handleWorkerLogs({
				scriptName,
				limit,
				minutesAgo,
				accountId: env.CLOUDFLARE_MOCK_ACCOUNT_ID,
				apiToken: env.CLOUDFLARE_MOCK_API_TOKEN,
				shouldFilterErrors: false,
			})

			expect(result.relevantLogs.length).toBe(0)
		})

		it('should handle API errors', async () => {
			const scriptName = 'error-worker'

			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/query`,
				})
				.reply(500, 'Server error')

			const limit = 100
			const minutesAgo = 30
			await expect(
				handleWorkerLogs({
					scriptName,
					limit,
					minutesAgo,
					accountId: env.CLOUDFLARE_MOCK_ACCOUNT_ID,
					apiToken: env.CLOUDFLARE_MOCK_API_TOKEN,
					shouldFilterErrors: false,
				})
			).rejects.toThrow('Cloudflare API request failed')
		})

		it('should filter logs by error status when requested', async () => {
			const scriptName = 'test-worker'

			const mockEvents = [
				{
					timestamp: Date.now() - 100000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'ok',
						eventType: 'fetch',
						requestId: '123456abcdef',
						wallTimeMs: 45.2,
						cpuTimeMs: 12.8,
						event: {
							request: {
								method: 'GET',
								path: '/api/v1/resource',
								url: 'https://example.com/api/v1/resource',
							},
							response: {
								status: 200,
							},
							rayId: 'ray123abc456def',
						},
					},
					source: {},
					dataset: 'cloudflare-workers',
					$metadata: { id: '1' },
				},
				{
					timestamp: Date.now() - 200000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'error',
						eventType: 'fetch',
						requestId: '456789bcdef01',
						wallTimeMs: 88.7,
						cpuTimeMs: 33.2,
						event: {
							request: {
								method: 'POST',
								path: '/api/v1/resource/create',
								url: 'https://example.com/api/v1/resource/create',
							},
							rayId: 'ray456def789ghi',
						},
					},
					source: {
						message: 'Invalid request data',
					},
					dataset: 'cloudflare-workers',
					$metadata: { id: '2', error: 'Invalid request data' },
				},
				{
					timestamp: Date.now() - 300000,
					$workers: {
						scriptName: 'test-worker',
						outcome: 'error',
						eventType: 'fetch',
						requestId: '789012defghi34',
						wallTimeMs: 112.3,
						cpuTimeMs: 45.8,
						event: {
							request: {
								method: 'PUT',
								path: '/api/v1/resource/update',
								url: 'https://example.com/api/v1/resource/update',
							},
							rayId: 'ray789ghi012jkl',
						},
					},
					source: {
						message: 'Resource not found',
					},
					dataset: 'cloudflare-workers',
					$metadata: { id: '3', error: 'Resource not found' },
				},
			]

			const mockResponse = {
				success: true,
				result: {
					events: {
						events: mockEvents.filter((event) => event.$workers.outcome === 'error'),
					},
				},
				errors: [],
				messages: [{ message: 'Successful request' }],
			}

			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/query`,
				})
				.reply(200, mockResponse)

			// error filtering enabled
			const limit = 100
			const minutesAgo = 30
			const result = await handleWorkerLogs({
				scriptName,
				limit,
				minutesAgo,
				accountId: env.CLOUDFLARE_MOCK_ACCOUNT_ID,
				apiToken: env.CLOUDFLARE_MOCK_API_TOKEN,
				shouldFilterErrors: true,
			})

			// Check results - we should only get error logs
			expect(result.relevantLogs.filter((log) => log.outcome === 'error').length).toBe(2)
			expect(result.relevantLogs.length).toBe(2)

			const firstErrorLog = result.relevantLogs.find((log) => log.error === 'Invalid request data')
			expect(firstErrorLog).toBeDefined()
			expect(firstErrorLog?.method).toBe('POST')
			expect(firstErrorLog?.rayId).toBe('ray456def789ghi')

			const secondErrorLog = result.relevantLogs.find((log) => log.error === 'Resource not found')
			expect(secondErrorLog).toBeDefined()
			expect(secondErrorLog?.method).toBe('PUT')
			expect(secondErrorLog?.rayId).toBe('ray789ghi012jkl')
		})
	})

	describe('handleWorkerLogsKeys', () => {
		it('should fetch worker telemetry keys correctly', async () => {
			const scriptName = 'test-worker'

			// Mock telemetry keys response
			const mockKeysResponse = {
				success: true,
				result: [
					{
						key: '$workers.outcome',
						type: 'string',
						lastSeen: Date.now() - 1000000,
					},
					{
						key: '$workers.wallTimeMs',
						type: 'number',
						lastSeen: Date.now() - 2000000,
					},
					{
						key: '$workers.event.error',
						type: 'boolean',
						lastSeen: Date.now() - 3000000,
					},
				],
				errors: [],
				messages: [{ message: 'Successful request' }],
			}

			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/keys`,
				})
				.reply(200, mockKeysResponse)

			const minutesAgo = 1440
			const result = await handleWorkerLogsKeys(
				scriptName,
				minutesAgo,
				env.CLOUDFLARE_MOCK_ACCOUNT_ID,
				env.CLOUDFLARE_MOCK_API_TOKEN
			)

			expect(result).toEqual(mockKeysResponse.result)
			expect(result.length).toBe(3)
			expect(result[0].key).toBe('$workers.outcome')
			expect(result[0].type).toBe('string')
			expect(result[1].key).toBe('$workers.wallTimeMs')
			expect(result[1].type).toBe('number')
			expect(result[2].key).toBe('$workers.event.error')
			expect(result[2].type).toBe('boolean')
		})

		it('should handle API errors when fetching keys', async () => {
			const scriptName = 'error-worker'

			// Setup mock for error response
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					method: 'POST',
					path: `/client/v4/accounts/${env.CLOUDFLARE_MOCK_ACCOUNT_ID}/workers/observability/telemetry/keys`,
				})
				.reply(500, 'Server error')

			const minutesAgo = 1440
			await expect(
				handleWorkerLogsKeys(
					scriptName,
					minutesAgo,
					env.CLOUDFLARE_MOCK_ACCOUNT_ID,
					env.CLOUDFLARE_MOCK_API_TOKEN
				)
			).rejects.toThrow('Cloudflare API request failed')
		})
	})
})
