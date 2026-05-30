import { z } from 'zod'

import { MISSING_ACCOUNT_ID_RESPONSE } from '@repo/mcp-common/src/constants'
import { getProps } from '@repo/mcp-common/src/get-props'
import { throwUpstreamApiError } from '@repo/mcp-common/src/mcp-error'

import type { IAMMCP } from '../iam.app'

// ============================================================================
// Token Management Schemas
// ============================================================================

const tokenStatusSchema = z.enum(['active', 'disabled', 'expired'])

const tokenPolicySchema = z.object({
	id: z.string().optional(),
	effect: z.enum(['allow', 'deny']),
	permission_groups: z.array(
		z.object({
			id: z.string(),
			meta: z.record(z.string()).optional(),
			name: z.string().optional(),
		})
	),
	resources: z.record(z.union([z.string(), z.record(z.string())])),
})

const tokenConditionSchema = z.object({
	request_ip: z
		.object({
			in: z.array(z.string()).optional(),
			not_in: z.array(z.string()).optional(),
		})
		.optional(),
})

const tokenSchema = z.object({
	id: z.string(),
	name: z.string(),
	status: tokenStatusSchema,
	issued_on: z.string().datetime().nullable().optional(),
	modified_on: z.string().datetime().nullable().optional(),
	expires_on: z.string().datetime().nullable().optional(),
	not_before: z.string().datetime().nullable().optional(),
	last_used_on: z.string().datetime().nullable().optional(),
	policies: z.array(tokenPolicySchema).nullable().optional(),
	condition: tokenConditionSchema.optional(),
})

const tokenListResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z.array(tokenSchema).optional(),
	result_info: z.object({
		count: z.number(),
		page: z.number().optional(),
		per_page: z.number().optional(),
		total_count: z.number().optional(),
		cursor: z.string().optional(),
	}),
})

const tokenDetailResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: tokenSchema.optional(),
})

const tokenCreateResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z
		.object({
			id: z.string(),
			name: z.string(),
			status: tokenStatusSchema,
			issued_on: z.string().datetime().nullable().optional(),
			modified_on: z.string().datetime().nullable().optional(),
			expires_on: z.string().datetime().nullable().optional(),
			not_before: z.string().datetime().nullable().optional(),
			last_used_on: z.string().datetime().nullable().optional(),
			policies: z.array(tokenPolicySchema).nullable().optional(),
			condition: tokenConditionSchema.optional(),
			value: z.string(),
		})
		.optional(),
})

const permissionGroupSchema = z.object({
	id: z.string(),
	name: z.string(),
	scopes: z.array(z.string()),
})

const permissionGroupListResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z.array(permissionGroupSchema).optional(),
	result_info: z
		.object({
			count: z.number(),
			page: z.number().optional(),
			per_page: z.number().optional(),
			total_count: z.number().optional(),
		})
		.optional(),
})

// ============================================================================
// Member Management Schemas
// ============================================================================

const memberRoleSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	permissions: z.record(
		z.object({
			read: z.boolean().optional(),
			write: z.boolean().optional(),
		})
	),
})

const memberPolicySchema = z.object({
	id: z.string(),
	access: z.enum(['allow', 'deny']),
	permission_groups: z
		.array(
			z.object({
				id: z.string(),
				meta: z.record(z.string()).optional(),
				name: z.string().optional(),
			})
		)
		.optional(),
	resource_groups: z
		.array(
			z.object({
				id: z.string(),
				scope: z
					.array(
						z.object({
							key: z.string(),
							objects: z.array(z.object({ key: z.string() })).optional(),
						})
					)
					.or(z.record(z.any())), // Can be array or object depending on API response
				meta: z.record(z.string()).optional(),
				name: z.string().optional(),
			})
		)
		.optional(),
})

const memberSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	status: z.enum(['accepted', 'pending']),
	roles: z.array(memberRoleSchema).nullable().optional(),
	policies: z.array(memberPolicySchema).nullable().optional(),
	user: z
		.object({
			id: z.string().nullable().optional(),
			email: z.string(),
			first_name: z.string().nullable().optional(),
			last_name: z.string().nullable().optional(),
			two_factor_authentication_enabled: z.boolean().optional(),
		})
		.optional(),
})

const memberListResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z.array(memberSchema).optional(),
	result_info: z.object({
		count: z.number(),
		page: z.number().optional(),
		per_page: z.number().optional(),
		total_count: z.number().optional(),
		cursor: z.string().optional(),
	}),
})

const memberDetailResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: memberSchema.optional(),
})

// ============================================================================
// Role Management Schemas
// ============================================================================

const roleSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	permissions: z.record(
		z.object({
			read: z.boolean().optional(),
			write: z.boolean().optional(),
		})
	),
})

const roleListResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: z.array(roleSchema).optional(),
	result_info: z.object({
		count: z.number(),
		page: z.number().optional(),
		per_page: z.number().optional(),
		total_count: z.number().optional(),
	}),
})

const roleDetailResponseSchema = z.object({
	success: z.literal(true),
	errors: z.array(z.object({ message: z.string() })).optional(),
	result: roleSchema.optional(),
})

/**
 * Makes a request to the Cloudflare API (supports both account-level and user-level endpoints)
 * @param endpoint API endpoint path (without the base URL)
 * @param accountId Cloudflare account ID (optional for user-level endpoints)
 * @param apiToken Cloudflare API token
 * @param responseSchema Zod schema for response validation
 * @param options Additional fetch options
 * @returns The API response
 */
async function fetchCloudflareApiExtended<T>({
	endpoint,
	accountId,
	apiToken,
	responseSchema,
	options = {},
}: {
	endpoint: string
	accountId?: string
	apiToken: string
	responseSchema?: z.ZodType<T>
	options?: RequestInit
}): Promise<T> {
	// Determine base URL - use /user prefix for user-level endpoints, otherwise /accounts/{id}
	const isUserEndpoint = endpoint.startsWith('/user')
	const url = isUserEndpoint
		? `https://api.cloudflare.com/client/v4${endpoint}`
		: `https://api.cloudflare.com/client/v4/accounts/${accountId}${endpoint}`

	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
			...(options.headers || {}),
		},
	})

	if (!response.ok) {
		throwUpstreamApiError(response.status, 'Cloudflare API', await response.text())
	}

	const data = await response.json()

	// If a schema is provided, validate the response
	if (responseSchema) {
		return responseSchema.parse(data)
	}

	return data as T
}

// Token API
async function listTokens(
	apiToken: string,
	params?: { direction?: 'asc' | 'desc'; page?: number; per_page?: number }
) {
	const query = new URLSearchParams()
	if (params?.direction) query.append('direction', params.direction)
	if (params?.page) query.append('page', String(params.page))
	if (params?.per_page) query.append('per_page', String(Math.min(params.per_page, 50)))

	const endpoint = query.toString() ? `/user/tokens?${query.toString()}` : '/user/tokens'

	return fetchCloudflareApiExtended({
		endpoint,
		apiToken,
		responseSchema: tokenListResponseSchema,
	})
}

async function getToken(tokenId: string, apiToken: string) {
	return fetchCloudflareApiExtended({
		endpoint: `/user/tokens/${tokenId}`,
		apiToken,
		responseSchema: tokenDetailResponseSchema,
	})
}

async function createToken(
	params: {
		name: string
		policies: z.infer<typeof tokenPolicySchema>[]
		expires_on?: string
		not_before?: string
		condition?: z.infer<typeof tokenConditionSchema>
	},
	apiToken: string
) {
	return fetchCloudflareApiExtended({
		endpoint: '/user/tokens',
		apiToken,
		responseSchema: tokenCreateResponseSchema,
		options: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		},
	})
}

async function updateToken(
	tokenId: string,
	params: {
		name?: string
		policies?: z.infer<typeof tokenPolicySchema>[]
		expires_on?: string
		not_before?: string
		status?: 'active' | 'disabled' | 'expired'
		condition?: z.infer<typeof tokenConditionSchema>
	},
	apiToken: string
) {
	return fetchCloudflareApiExtended({
		endpoint: `/user/tokens/${tokenId}`,
		apiToken,
		responseSchema: tokenDetailResponseSchema,
		options: {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		},
	})
}

async function deleteToken(tokenId: string, apiToken: string) {
	const response = (await fetchCloudflareApiExtended({
		endpoint: `/user/tokens/${tokenId}`,
		apiToken,
		responseSchema: z.object({
			success: z.literal(true),
			result: z.object({ id: z.string() }),
		}),
		options: { method: 'DELETE' },
	})) as { result: { id: string } }
	return { success: true as const, id: response.result.id }
}

async function rollToken(tokenId: string, apiToken: string) {
	const response = (await fetchCloudflareApiExtended({
		endpoint: `/user/tokens/${tokenId}/value`,
		apiToken,
		responseSchema: z.object({
			success: z.literal(true),
			result: z.string(),
		}),
		options: {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		},
	})) as { result: string }
	return { success: true as const, value: response.result }
}

async function verifyToken(apiToken: string) {
	const response = (await fetchCloudflareApiExtended({
		endpoint: '/user/tokens/verify',
		apiToken,
		responseSchema: z.object({
			success: z.literal(true),
			result: z.object({
				id: z.string(),
				status: z.string(),
				expires_on: z.string().optional(),
				not_before: z.string().optional(),
			}),
		}),
	})) as {
		result: { id: string; status: string; expires_on?: string; not_before?: string }
	}
	return { success: true as const, ...response.result }
}

async function listPermissionGroups(apiToken: string, params?: { name?: string; scope?: string }) {
	const query = new URLSearchParams()
	if (params?.name) query.append('name', params.name)
	if (params?.scope) query.append('scope', params.scope)

	const endpoint = query.toString()
		? `/user/tokens/permission_groups?${query.toString()}`
		: '/user/tokens/permission_groups'

	return fetchCloudflareApiExtended({
		endpoint,
		apiToken,
		responseSchema: permissionGroupListResponseSchema,
	})
}

// Member API
async function listMembers(
	accountId: string,
	apiToken: string,
	params?: {
		status?: 'accepted' | 'pending' | 'rejected'
		direction?: 'asc' | 'desc'
		order?: 'user.first_name' | 'user.last_name' | 'user.email' | 'status'
		page?: number
		per_page?: number
	}
) {
	const query = new URLSearchParams()
	if (params?.status) query.append('status', params.status)
	if (params?.direction) query.append('direction', params.direction)
	if (params?.order) query.append('order', params.order)
	if (params?.page) query.append('page', String(params.page))
	if (params?.per_page) query.append('per_page', String(Math.min(params.per_page, 50)))

	const endpoint = query.toString() ? `/members?${query.toString()}` : `/members`

	return fetchCloudflareApiExtended({
		endpoint,
		accountId,
		apiToken,
		responseSchema: memberListResponseSchema,
	})
}

async function getMember(accountId: string, memberId: string, apiToken: string) {
	return fetchCloudflareApiExtended({
		endpoint: `/members/${memberId}`,
		accountId,
		apiToken,
		responseSchema: memberDetailResponseSchema,
	})
}

async function addMember(
	accountId: string,
	params: { email: string; roles: string[]; status?: 'accepted' | 'pending' },
	apiToken: string
) {
	return fetchCloudflareApiExtended({
		endpoint: `/members`,
		accountId,
		apiToken,
		responseSchema: memberDetailResponseSchema,
		options: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		},
	})
}

async function updateMember(
	accountId: string,
	memberId: string,
	params: {
		roles?: { id: string; name?: string; description?: string }[]
		status?: 'accepted' | 'pending'
		policies?: z.infer<typeof memberPolicySchema>[]
	},
	apiToken: string
) {
	return fetchCloudflareApiExtended({
		endpoint: `/members/${memberId}`,
		accountId,
		apiToken,
		responseSchema: memberDetailResponseSchema,
		options: {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		},
	})
}

async function removeMember(accountId: string, memberId: string, apiToken: string) {
	const response = (await fetchCloudflareApiExtended({
		endpoint: `/members/${memberId}`,
		accountId,
		apiToken,
		responseSchema: z.object({
			success: z.literal(true),
			result: z.object({ id: z.string() }),
		}),
		options: { method: 'DELETE' },
	})) as { result: { id: string } }
	return { success: true as const, id: response.result.id }
}

// Role API
async function listRoles(
	accountId: string,
	apiToken: string,
	params?: { page?: number; per_page?: number }
) {
	const query = new URLSearchParams()
	if (params?.page) query.append('page', String(params.page))
	if (params?.per_page) query.append('per_page', String(Math.min(params.per_page, 50)))

	const endpoint = query.toString() ? `/roles?${query.toString()}` : `/roles`

	return fetchCloudflareApiExtended({
		endpoint,
		accountId,
		apiToken,
		responseSchema: roleListResponseSchema,
	})
}

async function getRole(accountId: string, roleId: string, apiToken: string) {
	return fetchCloudflareApiExtended({
		endpoint: `/roles/${roleId}`,
		accountId,
		apiToken,
		responseSchema: roleDetailResponseSchema,
	})
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Registers all Identity Management tools with the MCP server
 */
export function registerIAMTools(agent: IAMMCP) {
	// Token Management Tools
	agent.server.tool(
		'api_token_list',
		`List all User API tokens for the authenticated user.
		
Note: This only returns User API tokens (personal tokens you create for your own use). 
It does NOT return Account API tokens (service tokens created at the account level for automation).

Use this when the user wants to:
- See all their User API tokens
- List active, disabled, or expired tokens
- View token metadata (name, status, expiration dates)

Returns a list of tokens with their basic information. Does NOT return the token secret values.`,
		{
			direction: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
			page: z.number().min(1).optional().describe('Page number for pagination'),
			per_page: z.number().min(1).max(50).optional().describe('Items per page (max 50)'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await listTokens(props.accessToken, params)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing tokens: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_get',
		`Get detailed information about a specific API token including its policies and permissions.
		
Use this when the user wants to:
- View detailed information about a specific token
- See what permissions a token has
- Check which resources a token can access
- Review token conditions (IP restrictions)`,
		{
			token_id: z.string().describe('The unique identifier of the API token'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await getToken(params.token_id, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_create',
		`Create a new API token with specified permissions and policies.
		
IMPORTANT: The token value is ONLY returned when the token is created. It cannot be retrieved later.
Make sure the user saves the token value securely.

Use this when the user wants to:
- Create a new API token for automation
- Generate a token with specific permissions
- Set up a token for CI/CD pipelines
- Create a token with expiration date and IP restrictions

Policy Example:
{
  "name": "My API Token",
  "policies": [
    {
      "effect": "allow",
      "permission_groups": [{"id": "82e64a83756745bbbb1730c962c84d09"}],
      "resources": {
        "com.cloudflare.api.account.zone.*": "*"
      }
    }
  ]
}

Use api_permission_groups_list to find permission group IDs.
Resource patterns: "com.cloudflare.api.account.zone.<zone-id>", "com.cloudflare.api.account.*", etc.`,
		{
			name: z.string().min(1).max(120).describe('Name for the token'),
			policies: z
				.array(
					z.object({
						effect: z.enum(['allow', 'deny']).describe('Allow or deny access'),
						permission_groups: z
							.array(z.object({ id: z.string() }))
							.min(1)
							.describe('Permission groups to assign (at least one required)'),
						resources: z
							.record(z.union([z.string(), z.record(z.string())]))
							.describe(
								'Resources to grant access to. Example: {"com.cloudflare.api.account.zone.*": "*"}'
							),
					})
				)
				.min(1)
				.describe('Access policies for the token (at least one required)'),
			expires_on: z.string().datetime().optional().describe('Expiration date (ISO 8601)'),
			not_before: z.string().datetime().optional().describe('Start date (ISO 8601)'),
			condition: z
				.object({
					request_ip: z
						.object({
							in: z.array(z.string()).optional().describe('Allowed IP CIDRs'),
							not_in: z.array(z.string()).optional().describe('Denied IP CIDRs'),
						})
						.optional(),
				})
				.optional()
				.describe('IP restriction conditions'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await createToken(params, props.accessToken)
				const response = {
					...result,
					warning:
						'IMPORTANT: The token value shown above is only displayed once. Save it securely now - it cannot be retrieved later!',
				}
				return { content: [{ type: 'text', text: JSON.stringify(response) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_update',
		`Update an existing API token's name, policies, status, or expiration.
		
Use this when the user wants to:
- Rename a token
- Change token permissions
- Disable or enable a token
- Update token expiration
- Modify IP restrictions

Note: Cannot update the token value itself. To rotate a token, use api_token_roll.

Policy Example:
{
  "policies": [
    {
      "effect": "allow",
      "permission_groups": [{"id": "82e64a83756745bbbb1730c962c84d09"}],
      "resources": {
        "com.cloudflare.api.account.zone.*": "*"
      }
    }
  ]
}

Use api_permission_groups_list to find permission group IDs.
Resource patterns: "com.cloudflare.api.account.zone.<zone-id>", "com.cloudflare.api.account.*", etc.`,
		{
			token_id: z.string().describe('Token identifier to update'),
			name: z.string().min(1).max(120).optional().describe('New name for the token'),
			policies: z
				.array(
					z.object({
						effect: z.enum(['allow', 'deny']).describe('Allow or deny access'),
						permission_groups: z
							.array(z.object({ id: z.string() }))
							.min(1)
							.describe('Permission groups to assign (at least one required)'),
						resources: z
							.record(z.union([z.string(), z.record(z.string())]))
							.describe(
								'Resources to grant access to. Example: {"com.cloudflare.api.account.zone.*": "*"}'
							),
					})
				)
				.optional()
				.describe(
					'New access policies. Omit to keep existing policies. Empty array will remove all permissions.'
				),
			status: z.enum(['active', 'disabled', 'expired']).optional().describe('New status'),
			expires_on: z.string().datetime().optional().describe('New expiration date'),
			not_before: z.string().datetime().optional().describe('New start date'),
			condition: z
				.object({
					request_ip: z
						.object({
							in: z.array(z.string()).optional(),
							not_in: z.array(z.string()).optional(),
						})
						.optional(),
				})
				.optional()
				.describe('New IP restrictions'),
		},
		async (params) => {
			try {
				const { token_id, ...updateData } = params
				const props = getProps(agent)
				const result = await updateToken(token_id, updateData, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_delete',
		`Delete an API token permanently. This action cannot be undone.
		
Use this when the user wants to:
- Revoke a token
- Delete an old or unused token
- Remove a compromised token

WARNING: This will immediately invalidate the token. Any applications using it will stop working.`,
		{
			token_id: z.string().describe('Token identifier to delete'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await deleteToken(params.token_id, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_roll',
		`Roll (rotate) an API token to generate a new secret value.
		
IMPORTANT: The new token value is ONLY returned once. The old token value will stop working immediately.

Use this when the user wants to:
- Rotate a token for security
- Replace a potentially compromised token
- Update token credentials periodically

Make sure the user saves the new token value securely - the old one will no longer work!`,
		{
			token_id: z.string().describe('Token identifier to roll'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await rollToken(params.token_id, props.accessToken)
				const response = {
					...result,
					warning:
						'IMPORTANT: The new token value is shown above. The old token value no longer works! Save this securely.',
				}
				return { content: [{ type: 'text', text: JSON.stringify(response) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error rolling token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_token_verify',
		`Verify the current API token's validity, status, and expiration.
		
Use this when the user wants to:
- Check if their token is still valid
- See when their token expires
- Verify token status (active, disabled, expired)
- Troubleshoot authentication issues

Returns the token ID, status, and expiration dates without exposing the token value.`,
		{},
		async () => {
			try {
				const props = getProps(agent)
				const result = await verifyToken(props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error verifying token: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'api_permission_groups_list',
		`List all available permission groups that can be assigned to API tokens.
		
Use this when the user wants to:
- See what permissions are available
- Find permission group IDs for creating tokens
- Understand what access levels exist
- Search for specific permissions by name

Returns permission groups with their IDs, names, and applicable scopes.`,
		{
			name: z.string().optional().describe('Filter by permission group name'),
			scope: z.string().optional().describe('Filter by scope (e.g., com.cloudflare.api.account)'),
		},
		async (params) => {
			try {
				const props = getProps(agent)
				const result = await listPermissionGroups(props.accessToken, params)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing permission groups: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Member Management Tools
	agent.server.tool(
		'account_members_list',
		`List all members of a Cloudflare account with their roles and status.
		
Use this when the user wants to:
- See who has access to their account
- List pending member invitations
- View member roles and permissions
- Check member status (accepted, pending)

Requires an active account. Use accounts_list and set_active_account if needed.`,
		{
			status: z
				.enum(['accepted', 'pending', 'rejected'])
				.optional()
				.describe('Filter by member status'),
			direction: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
			order: z
				.enum(['user.first_name', 'user.last_name', 'user.email', 'status'])
				.optional()
				.describe('Sort field'),
			page: z.number().min(1).optional().describe('Page number'),
			per_page: z.number().min(1).max(50).optional().describe('Items per page (max 50)'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await listMembers(accountId, props.accessToken, params)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing members: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'account_member_get',
		`Get detailed information about a specific account member.
		
Use this when the user wants to:
- View a member's complete details
- See all roles assigned to a member
- Check a member's policies and permissions
- View user information (name, email, 2FA status)

Requires the member ID (use account_members_list to find it).`,
		{
			member_id: z.string().describe('The membership identifier'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await getMember(accountId, params.member_id, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting member: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'account_member_add',
		`Add a new member to the account or invite them via email.
		
Use this when the user wants to:
- Invite a new user to the account
- Add a member with specific roles
- Grant account access to a team member

Required: email address and at least one role ID
Optional: status (defaults to 'pending' which sends an invitation email)

Use roles_list to get available role IDs for your account.

Example:
{
  "email": "user@example.com",
  "roles": ["05784afa30c1afe1440e79d9351c7430"],
  "status": "pending"
}

Requires Account Memberships > Edit permission.`,
		{
			email: z.string().email().describe('Email address of the user to invite'),
			roles: z.array(z.string()).min(1).describe('Array of role IDs (at least one required). Use roles_list to find valid IDs.'),
			status: z
				.enum(['accepted', 'pending'])
				.optional()
				.describe('Member status: "pending" sends invitation email (default), "accepted" adds immediately'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await addMember(accountId, params, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				// Extract more details from McpError if available
				const errorDetails =
					error instanceof Error
						? JSON.stringify(
								{
									message: error.message,
									details: (error as { internalMessage?: string; details?: unknown }).internalMessage || (error as { details?: unknown }).details,
									cause: (error as { cause?: unknown }).cause,
								},
								null,
								2
							)
						: String(error)
				return {
					content: [
						{
							type: 'text',
							text: `Error adding member: ${errorDetails}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'account_member_update',
		`Update an account member's roles, status, or policies.
		
Use this when the user wants to:
- Change a member's roles
- Accept or resend a pending invitation
- Update member's permissions
- Modify member policies

Requires the member ID. Use roles_list to get available role IDs.

Roles Example:
{
  "member_id": "member-id-here",
  "roles": [
    {"id": "05784afa30c1afe1440e79d9351c7430"}
  ]
}

Note: Most commonly you'll update roles. Policies are for advanced custom permissions.`,
		{
			member_id: z.string().describe('The membership identifier to update'),
			roles: z
				.array(z.object({ id: z.string().describe('Role ID from roles_list') }))
				.optional()
				.describe('New roles to assign. Omit to keep existing roles. Empty array removes all roles.'),
			status: z.enum(['accepted', 'pending']).optional().describe('New member status'),
			policies: z
				.array(memberPolicySchema)
				.optional()
				.describe(
					'New custom policies to assign. Omit to keep existing policies. Empty array removes all policies.'
				),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const { member_id, ...updateData } = params
				const props = getProps(agent)
				const result = await updateMember(accountId, member_id, updateData, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating member: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'account_member_remove',
		`Remove a member from the account. This revokes all their access.
		
Use this when the user wants to:
- Remove a user from the account
- Revoke someone's access
- Cancel a pending invitation

WARNING: This immediately removes all access. The user will be notified.`,
		{
			member_id: z.string().describe('The membership identifier to remove'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await removeMember(accountId, params.member_id, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error removing member: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Role Management Tools
	agent.server.tool(
		'account_roles_list',
		`List all available roles for the account with their permissions.
		
Use this when the user wants to:
- See what roles are available
- Understand role permissions
- Get role IDs for adding/updating members
- View detailed permission breakdowns

Returns all standard and custom roles with their full permission sets.`,
		{
			page: z.number().min(1).optional().describe('Page number'),
			per_page: z.number().min(1).max(50).optional().describe('Items per page (max 50)'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await listRoles(accountId, props.accessToken, params)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing roles: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'account_role_get',
		`Get detailed information about a specific role including all permissions.
		
Use this when the user wants to:
- Understand what a specific role can do
- See detailed permissions for a role
- Compare roles

Requires the role ID (use account_roles_list to find it).`,
		{
			role_id: z.string().describe('The role identifier'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) return MISSING_ACCOUNT_ID_RESPONSE

			try {
				const props = getProps(agent)
				const result = await getRole(accountId, params.role_id, props.accessToken)
				return { content: [{ type: 'text', text: JSON.stringify(result) }] }
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting role: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
