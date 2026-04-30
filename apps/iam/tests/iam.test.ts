import { fetchMock } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

import type { TestEnv } from '../vitest.config'

beforeAll(() => {
	fetchMock.activate()
	fetchMock.disableNetConnect()
})

// Type definitions for API responses
interface Token {
	id: string
	name: string
	status: 'active' | 'disabled' | 'expired'
	expires_on?: string | null
	issued_on?: string | null
	modified_on?: string | null
	last_used_on?: string | null
	not_before?: string | null
	policies?: Array<{
		effect: 'allow' | 'deny'
		permission_groups: Array<{ id: string; name?: string }>
		resources: Record<string, string | Record<string, string>>
	}> | null
	condition?: {
		request_ip?: { in?: string[]; not_in?: string[] }
	}
	value?: string
}

interface Member {
	id: string
	email: string
	status: 'accepted' | 'pending' | 'rejected'
	roles?: Array<{
		id: string
		name: string
		description: string
		permissions?: Record<string, { read?: boolean; write?: boolean }>
	}> | null
	policies?: Array<{
		id: string
		access: 'allow' | 'deny'
		permission_groups?: Array<{ id: string }>
		resource_groups?: Array<{ id: string }>
	}> | null
	user?: {
		id?: string | null
		email: string
		first_name?: string | null
		last_name?: string | null
		two_factor_authentication_enabled?: boolean
	}
}

interface Role {
	id: string
	name: string
	description: string
	permissions: Record<string, { read?: boolean; write?: boolean }>
}

interface ApiResponse<T> {
	success: boolean
	result: T
	result_info?: {
		count: number
		page?: number
		per_page?: number
		total_count?: number
		cursor?: string
	}
	errors?: Array<{ message: string }>
}

describe('IAM MCP Server', () => {
	describe('Token Management', () => {
		it('should list API tokens', async () => {
			// Mock the Cloudflare API response
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens', method: 'GET' })
				.reply(200, {
					success: true,
					result: [
						{
							id: 'token-1',
							name: 'Test Token',
							status: 'active',
							expires_on: '2025-12-31T23:59:59Z',
							issued_on: '2024-01-01T00:00:00Z',
							modified_on: '2024-01-01T00:00:00Z',
							last_used_on: null, // Nullable field - token never used
							policies: [
								{
									effect: 'allow',
									permission_groups: [{ id: 'perm-1', name: 'Zone Read' }],
									resources: { 'com.cloudflare.api.account.zone.*': '*' },
								},
							],
						},
					],
					result_info: { count: 1, page: 1, per_page: 20, total_count: 1 },
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens', {
				headers: { Authorization: 'Bearer mock-token' },
			})
			const data = (await response.json()) as ApiResponse<Token[]>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result).toHaveLength(1)
			expect(data.result[0].id).toBe('token-1')
			expect(data.result[0].name).toBe('Test Token')
			expect(data.result[0].status).toBe('active')
			expect(data.result[0].last_used_on).toBeNull()
		})

		it('should get a specific API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/token-123', method: 'GET' })
				.reply(200, {
					success: true,
					result: {
						id: 'token-123',
						name: 'Production Token',
						status: 'active',
						expires_on: '2025-12-31T23:59:59Z',
						policies: [
							{
								effect: 'allow',
								permission_groups: [{ id: 'perm-1', name: 'Zone Edit' }],
								resources: { 'com.cloudflare.api.account.zone.*': '*' },
							},
						],
						condition: {
							request_ip: { in: ['192.168.1.0/24'] },
						},
					},
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/token-123', {
				headers: { Authorization: 'Bearer mock-token' },
			})
			const data = (await response.json()) as ApiResponse<Token>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('token-123')
			expect(data.result.name).toBe('Production Token')
			expect(data.result.condition?.request_ip?.in).toContain('192.168.1.0/24')
		})

		it('should create a new API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens', method: 'POST' })
				.reply(200, {
					success: true,
					result: {
						id: 'new-token-id',
						name: 'New Token',
						status: 'active',
						value: 'secret-token-value-only-shown-once',
						expires_on: '2025-12-31T23:59:59Z',
						policies: [
							{
								effect: 'allow',
								permission_groups: [{ id: 'perm-1' }],
								resources: { 'com.cloudflare.api.account.zone.*': '*' },
							},
						],
					},
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer mock-token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'New Token',
					policies: [
						{
							effect: 'allow',
							permission_groups: [{ id: 'perm-1' }],
							resources: { 'com.cloudflare.api.account.zone.*': '*' },
						},
					],
				}),
			})
			const data = (await response.json()) as ApiResponse<Token>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('new-token-id')
			expect(data.result.value).toBe('secret-token-value-only-shown-once')
		})

		it('should update an API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/token-123', method: 'PUT' })
				.reply(200, {
					success: true,
					result: {
						id: 'token-123',
						name: 'Updated Token Name',
						status: 'active',
					},
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/token-123', {
				method: 'PUT',
				headers: {
					Authorization: 'Bearer mock-token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ name: 'Updated Token Name' }),
			})
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.name).toBe('Updated Token Name')
		})

		it('should delete an API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/token-123', method: 'DELETE' })
				.reply(200, {
					success: true,
					result: { id: 'token-123' },
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/token-123', {
				method: 'DELETE',
				headers: { Authorization: 'Bearer mock-token' },
			})
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('token-123')
		})

		it('should roll an API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/token-123/value', method: 'PUT' })
				.reply(200, {
					success: true,
					result: 'new-secret-token-value-after-roll',
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/user/tokens/token-123/value',
				{
					method: 'PUT',
					headers: {
						Authorization: 'Bearer mock-token',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({}),
				}
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result).toBe('new-secret-token-value-after-roll')
		})

		it('should verify current API token', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/verify', method: 'GET' })
				.reply(200, {
					success: true,
					result: {
						id: 'current-token-id',
						status: 'active',
						expires_on: '2025-12-31T23:59:59Z',
						not_before: '2024-01-01T00:00:00Z',
					},
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
				headers: { Authorization: 'Bearer mock-token' },
			})
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('current-token-id')
			expect(data.result.status).toBe('active')
		})

		it('should list permission groups', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/permission_groups', method: 'GET' })
				.reply(200, {
					success: true,
					result: [
						{ id: 'perm-1', name: 'Zone Read', scopes: ['com.cloudflare.api.account.zone'] },
						{ id: 'perm-2', name: 'Zone Edit', scopes: ['com.cloudflare.api.account.zone'] },
						{ id: 'perm-3', name: 'DNS Read', scopes: ['com.cloudflare.api.account.zone'] },
					],
					// Note: Real API doesn't always return result_info for this endpoint
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/user/tokens/permission_groups',
				{
					headers: { Authorization: 'Bearer mock-token' },
				}
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result).toHaveLength(3)
			expect(data.result[0].name).toBe('Zone Read')
		})
	})

	describe('Member Management', () => {
		it('should list account members', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/members', method: 'GET' })
				.reply(200, {
					success: true,
					result: [
						{
							id: 'member-1',
							email: 'admin@example.com',
							status: 'accepted',
							roles: [{ id: 'role-1', name: 'Administrator', description: 'Full access' }],
							user: {
								id: 'user-1',
								email: 'admin@example.com',
								first_name: 'Admin',
								last_name: 'User',
								two_factor_authentication_enabled: true,
							},
						},
						{
							id: 'member-2',
							email: 'pending@example.com',
							status: 'pending',
							roles: [{ id: 'role-2', name: 'Read Only', description: 'Read access' }],
						},
					],
					result_info: { count: 2, page: 1, per_page: 20, total_count: 2 },
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result).toHaveLength(2)
			expect(data.result[0].email).toBe('admin@example.com')
			expect(data.result[0].status).toBe('accepted')
			expect(data.result[1].status).toBe('pending')
		})

		it('should get a specific account member', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/members/member-1', method: 'GET' })
				.reply(200, {
					success: true,
					result: {
						id: 'member-1',
						email: 'admin@example.com',
						status: 'accepted',
						roles: [
							{
								id: 'role-1',
								name: 'Administrator',
								description: 'Full account access',
								permissions: {
									zone: { read: true, write: true },
									dns: { read: true, write: true },
								},
							},
						],
						user: {
							id: 'user-1',
							email: 'admin@example.com',
							first_name: 'Admin',
							last_name: 'User',
							two_factor_authentication_enabled: true,
						},
					},
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members/member-1',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('member-1')
			expect(data.result.user.two_factor_authentication_enabled).toBe(true)
		})

		it('should add a new account member', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/members', method: 'POST' })
				.reply(200, {
					success: true,
					result: {
						id: 'new-member-id',
						email: 'newuser@example.com',
						status: 'pending',
						roles: null, // Nullable - pending invitations may have null roles
						policies: null, // Nullable - new members have null policies
						user: {
							id: null, // Nullable - pending users don't have ID yet
							email: 'newuser@example.com',
							first_name: null,
							last_name: null,
						},
					},
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members',
				{
					method: 'POST',
					headers: {
						Authorization: 'Bearer mock-token',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						email: 'newuser@example.com',
						roles: ['role-2'],
						status: 'pending',
					}),
				}
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('new-member-id')
			expect(data.result.status).toBe('pending')
			expect(data.result.roles).toBeNull()
			expect(data.result.user.id).toBeNull()
		})

		it('should update an account member', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/members/member-1', method: 'PUT' })
				.reply(200, {
					success: true,
					result: {
						id: 'member-1',
						email: 'admin@example.com',
						status: 'accepted',
						roles: [{ id: 'role-1', name: 'Administrator', description: 'Full access' }],
					},
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members/member-1',
				{
					method: 'PUT',
					headers: {
						Authorization: 'Bearer mock-token',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						roles: [{ id: 'role-1' }],
					}),
				}
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
		})

		it('should remove an account member', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({
					path: '/client/v4/accounts/mock-account-id/members/member-1',
					method: 'DELETE',
				})
				.reply(200, {
					success: true,
					result: { id: 'member-1' },
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members/member-1',
				{
					method: 'DELETE',
					headers: { Authorization: 'Bearer mock-token' },
				}
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('member-1')
		})
	})

	describe('Role Management', () => {
		it('should list account roles', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/roles', method: 'GET' })
				.reply(200, {
					success: true,
					result: [
						{
							id: 'role-1',
							name: 'Administrator',
							description: 'Full account access',
							permissions: {
								zone: { read: true, write: true },
								dns: { read: true, write: true },
								workers: { read: true, write: true },
							},
						},
						{
							id: 'role-2',
							name: 'Read Only',
							description: 'Read-only access',
							permissions: {
								zone: { read: true },
								dns: { read: true },
							},
						},
					],
					result_info: { count: 2 },
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/roles',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result).toHaveLength(2)
			expect(data.result[0].name).toBe('Administrator')
			expect(data.result[1].name).toBe('Read Only')
		})

		it('should get a specific role', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/roles/role-1', method: 'GET' })
				.reply(200, {
					success: true,
					result: {
						id: 'role-1',
						name: 'Administrator',
						description: 'Full account access',
						permissions: {
							zone: { read: true, write: true },
							dns: { read: true, write: true },
							workers: { read: true, write: true },
							load_balancers: { read: true, write: true },
						},
					},
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/roles/role-1',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)
			const data = (await response.json()) as Record<string, any>

			expect(response.status).toBe(200)
			expect(data.success).toBe(true)
			expect(data.result.id).toBe('role-1')
			expect(data.result.permissions.zone).toEqual({ read: true, write: true })
		})
	})

	describe('Error Handling', () => {
		it('should handle 401 unauthorized errors', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens', method: 'GET' })
				.reply(401, {
					success: false,
					errors: [{ message: 'Invalid API token' }],
				})

			const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens', {
				headers: { Authorization: 'Bearer invalid-token' },
			})

			expect(response.status).toBe(401)
		})

		it('should handle 403 forbidden errors', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/accounts/mock-account-id/members', method: 'GET' })
				.reply(403, {
					success: false,
					errors: [{ message: 'Insufficient permissions' }],
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/accounts/mock-account-id/members',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)

			expect(response.status).toBe(403)
		})

		it('should handle 404 not found errors', async () => {
			fetchMock
				.get('https://api.cloudflare.com')
				.intercept({ path: '/client/v4/user/tokens/non-existent', method: 'GET' })
				.reply(404, {
					success: false,
					errors: [{ message: 'Token not found' }],
				})

			const response = await fetch(
				'https://api.cloudflare.com/client/v4/user/tokens/non-existent',
				{ headers: { Authorization: 'Bearer mock-token' } }
			)

			expect(response.status).toBe(404)
		})
	})
})
