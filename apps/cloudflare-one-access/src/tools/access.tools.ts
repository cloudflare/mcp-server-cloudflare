import { PolicyTestCreateParams } from 'cloudflare/resources/zero-trust/access/applications.mjs'
import { z } from 'zod'

import { withAccountCheck } from '@repo/mcp-common/src/api/account.api'
import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { ToolDefinition } from '@repo/mcp-common/src/types/tools.types'

// Assuming a similar MCP type for Access as you have for Gateway
import type { ZeroTrustAccessMCP } from '../access.app'

const toolDefinitions: Array<ToolDefinition<any>> = [
	// Applications
	{
		name: 'zero_trust_access_applications_list',
		description: 'List Access Applications',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_application_get',
		description: 'Get a specific Access Application',
		params: { applicationId: z.string().describe('The UUID of the Access Application') },
		handler: async ({
			accountId,
			apiToken,
			applicationId,
		}: {
			accountId: string
			apiToken: string
			applicationId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.get(applicationId, {
				account_id: accountId,
			})
		},
	},

	// Application Policies
	{
		name: 'zero_trust_access_application_policies_list',
		description: 'List policies for an Access Application',
		params: { applicationId: z.string().describe('The UUID of the Access Application') },
		handler: async ({
			accountId,
			apiToken,
			applicationId,
		}: {
			accountId: string
			apiToken: string
			applicationId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.policies.list(applicationId, {
				account_id: accountId,
			})
		},
	},
	{
		name: 'zero_trust_access_application_policy_get',
		description: 'Get a specific policy for an Access Application',
		params: {
			applicationId: z.string().describe('The UUID of the Access Application'),
			policyId: z.string().describe('The UUID of the Access Policy'),
		},
		handler: async ({
			accountId,
			apiToken,
			applicationId,
			policyId,
		}: {
			accountId: string
			apiToken: string
			applicationId: string
			policyId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.policies.get(applicationId, policyId, {
				account_id: accountId,
			})
		},
	},

	// Application Policy Tests
	{
		name: 'Start Access Application Policy Test',
		description: 'Start a policy test for an Access Application',
		params: {
			policies: z.array(z.string().describe('Policy ID')).optional(),
		},
		handler: async ({
			accountId,
			apiToken,
			policies,
		}: {
			accountId: string
			apiToken: string
			policies?: Array<PolicyTestCreateParams.UnionMember0 | string>
		}) =>
			await getCloudflareClient(apiToken).zeroTrust.access.applications.policyTests.create({
				account_id: accountId,
				policies,
			}),
	},
	{
		name: 'get_policy_test_status',
		description: 'Get the current status of a policy test for an Access Application',
		params: { policyTestId: z.string().describe('Policy Test ID') },
		handler: async ({
			accountId,
			apiToken,
			policyTestId,
		}: {
			accountId: string
			apiToken: string
			policyTestId: string
		}) =>
			await getCloudflareClient(apiToken).zeroTrust.access.applications.policyTests.get(
				policyTestId,
				{ account_id: accountId }
			),
	},
	{
		name: 'user_access_policy_check',
		description: 'Test if a specific user has permission to access an application',
		params: { applicationId: z.string().describe('The UUID of the Access Application') },
		handler: async ({
			accountId,
			apiToken,
			applicationId,
		}: {
			accountId: string
			apiToken: string
			applicationId: string
		}) =>
			await getCloudflareClient(apiToken).zeroTrust.access.applications.userPolicyChecks.list(
				applicationId,
				{ account_id: accountId }
			),
	},

	// Short-Lived Certificate CAs
	{
		name: 'zero_trust_access_cas_list',
		description: 'List Access Short-Lived Certificate CAs for the account',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.cas.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_ca_get',
		description: 'Get an Access Short-Lived Certificate CA for an application',
		params: { applicationId: z.string().describe('The UUID of the Access Application') },
		handler: async ({
			accountId,
			apiToken,
			applicationId,
		}: {
			accountId: string
			apiToken: string
			applicationId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.applications.cas.get(applicationId, {
				account_id: accountId,
			})
		},
	},

	// Reusable Access Policies
	{
		name: 'zero_trust_access_policies_list',
		description: 'List reusable Access Policies',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.policies.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_policy_get',
		description: 'Get a specific reusable Access Policy',
		params: { policyId: z.string().describe('The UUID of the Access Policy') },
		handler: async ({
			accountId,
			apiToken,
			policyId,
		}: {
			accountId: string
			apiToken: string
			policyId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.policies.get(policyId, { account_id: accountId })
		},
	},

	// Service Tokens
	{
		name: 'zero_trust_access_service_tokens_list',
		description: 'List Access Service Tokens',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.serviceTokens.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_service_token_get',
		description: 'Get a specific Access Service Token',
		params: { serviceTokenId: z.string().describe('The UUID of the Service Token') },
		handler: async ({
			accountId,
			apiToken,
			serviceTokenId,
		}: {
			accountId: string
			apiToken: string
			serviceTokenId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.serviceTokens.get(serviceTokenId, {
				account_id: accountId,
			})
		},
	},

	// Bookmarks
	{
		name: 'zero_trust_access_bookmarks_list',
		description: 'List Access Bookmarks',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.bookmarks.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_bookmark_get',
		description: 'Get a specific Access Bookmark',
		params: { bookmarkId: z.string().describe('The UUID of the Bookmark') },
		handler: async ({
			accountId,
			apiToken,
			bookmarkId,
		}: {
			accountId: string
			apiToken: string
			bookmarkId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.bookmarks.get(bookmarkId, { account_id: accountId })
		},
	},

	// Custom Pages
	{
		name: 'zero_trust_access_custom_pages_list',
		description: 'List Access Custom Pages',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.customPages.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_custom_page_get',
		description: 'Get a specific Access Custom Page',
		params: { customPageId: z.string().describe('The UUID of the Custom Page') },
		handler: async ({
			accountId,
			apiToken,
			customPageId,
		}: {
			accountId: string
			apiToken: string
			customPageId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.customPages.get(customPageId, { account_id: accountId })
		},
	},

	// Groups
	{
		name: 'zero_trust_access_groups_list',
		description: 'List Access Groups',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.groups.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_group_get',
		description: 'Get a specific Access Group',
		params: { groupId: z.string().describe('The UUID of the Access Group') },
		handler: async ({
			accountId,
			apiToken,
			groupId,
		}: {
			accountId: string
			apiToken: string
			groupId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.groups.get(groupId, { account_id: accountId })
		},
	},

	// Keys
	{
		name: 'zero_trust_access_keys_get_configuration',
		description: 'Get the Access Key Configuration',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.keys.get({ account_id: accountId })
		},
	},

	// Mutual TLS Certificates
	{
		name: 'zero_trust_access_mtls_certificates_list',
		description: 'List Access Mutual TLS Certificates',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.certificates.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_mtls_certificate_get',
		description: 'Get a specific Access Mutual TLS Certificate',
		params: { certificateId: z.string().describe('The UUID of the mTLS Certificate') },
		handler: async ({
			accountId,
			apiToken,
			certificateId,
		}: {
			accountId: string
			apiToken: string
			certificateId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.certificates.get(certificateId, {
				account_id: accountId,
			})
		},
	},

	// Gateway CA
	{
		name: 'zero_trust_access_gateway_ca_list',
		description: 'List Access Gateway CAs',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) =>
			await getCloudflareClient(apiToken).zeroTrust.access.gatewayCA.list({
				account_id: accountId,
			}),
	},

	// Tags
	{
		name: 'zero_trust_access_tags_list',
		description: 'List all Access Tags',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.tags.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_tag_get',
		description: 'Get a specific Access Tag',
		params: { tagName: z.string().describe('The name of the tag') },
		handler: async ({
			accountId,
			apiToken,
			tagName,
		}: {
			accountId: string
			apiToken: string
			tagName: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.tags.get(tagName, { account_id: accountId })
		},
	},

	// User Checks
	{
		name: 'zero_trust_access_user_failed_logins_list',
		description: "Get a user's failed login attempts",
		params: { userId: z.string().describe("The user's UUID") },
		handler: async ({
			accountId,
			apiToken,
			userId,
		}: {
			accountId: string
			apiToken: string
			userId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.users.failedLogins.list(userId, {
				account_id: accountId,
			})
		},
	},
	{
		name: 'zero_trust_access_user_active_sessions_get',
		description: "Get a user's active sessions",
		params: {
			userId: z.string().describe("The user's UUID"),
			nonce: z.string().describe('The nonce'),
		},
		handler: async ({
			accountId,
			apiToken,
			userId,
			nonce,
		}: {
			accountId: string
			apiToken: string
			userId: string
			nonce: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.users.activeSessions.get(userId, nonce, {
				account_id: accountId,
			})
		},
	},

	// Infrastructure Targets
	{
		name: 'zero_trust_access_infrastructure_targets_list',
		description: 'List Access Infrastructure Targets',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.infrastructure.targets.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_infrastructure_target_get',
		description: 'Get a specific Access Infrastructure Target',
		params: { targetId: z.string().describe('The UUID of the Access Infrastructure Target') },
		handler: async ({
			accountId,
			apiToken,
			targetId,
		}: {
			accountId: string
			apiToken: string
			targetId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.infrastructure.targets.get(targetId, {
				account_id: accountId,
			})
		},
	},

	// Access Authentication Logs
	{
		name: 'zero_trust_access_authentication_logs_list',
		description: 'List Access Authentication Logs',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) =>
			await getCloudflareClient(apiToken).zeroTrust.access.logs.accessRequests.list({
				account_id: accountId,
			}),
	},
	{
		name: 'zero_trust_access_logs_scim_updates',
		description: 'List Access SCIM Updates',
		params: {
			idpIds: z.array(z.string()).describe('The UUID of the Identity Provider'),
		},
		handler: async ({
			accountId,
			apiToken,
			idpIds,
		}: {
			accountId: string
			apiToken: string
			idpIds: string[]
		}) =>
			await getCloudflareClient(apiToken).zeroTrust.access.logs.scim.updates.list({
				account_id: accountId,
				idp_id: idpIds,
			}),
	},

	// Keys
	{
		name: 'get_access_key_configuration',
		description: 'Get the Access Key Configuration',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.keys.get({ account_id: accountId })
		},
	},

	// Users
	{
		name: 'zero_trust_access_users_list',
		description: 'List Access Users',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) =>
			await getCloudflareClient(apiToken).zeroTrust.access.users.list({ account_id: accountId }),
	},
	{
		name: 'zero_trsut_access_user_active_sessions_list',
		description: 'List Access User Active Sessions',
		params: {
			userId: z.string().describe('The UUID of the User'),
		},
		handler: async ({
			accountId,
			apiToken,
			userId,
		}: {
			accountId: string
			apiToken: string
			userId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.users.activeSessions.list(userId, {
				account_id: accountId,
			})
		},
	},
	{
		name: 'zero_trsut_access_user_failed_logins_list',
		description: 'List Access User Failed Logins',
		params: {
			userId: z.string().describe('The UUID of the User'),
		},
		handler: async ({
			accountId,
			apiToken,
			userId,
		}: {
			accountId: string
			apiToken: string
			userId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.users.failedLogins.list(userId, {
				account_id: accountId,
			})
		},
	},
	{
		name: 'zero_trust_access_users_last_seen_identity_get',
		description: 'Get the last seen identity for a specific Access User',
		params: {
			userId: z.string().describe('The UUID of the User'),
		},
		handler: async ({
			accountId,
			apiToken,
			userId,
		}: {
			accountId: string
			apiToken: string
			userId: string
		}) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.access.users.lastSeenIdentity.get(userId, {
				account_id: accountId,
			})
		},
	},

	// identity providers
	{
		name: 'zero_trust_access_identity_providers_list',
		description: 'List Access Identity Providers',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const client = getCloudflareClient(apiToken)
			return await client.zeroTrust.identityProviders.list({ account_id: accountId })
		},
	},
	{
		name: 'zero_trust_access_identity_provider_get',
		description: 'Get Access Identity Provider',
		params: {
			identityProviderId: z.string().describe('The UUID of the Identity Provider'),
		},
		handler: async ({
			accountId,
			apiToken,
			identityProviderId,
		}: {
			accountId: string
			apiToken: string
			identityProviderId: string
		}) => {
			return await getCloudflareClient(apiToken).zeroTrust.identityProviders.get(
				identityProviderId,
				{
					account_id: accountId,
				}
			)
		},
	},
]

/**
 * Registers the Access tools with the MCP server
 * @param agent The MCP server instance
 */
export function registerZeroTrustAccessTools(agent: ZeroTrustAccessMCP) {
	toolDefinitions.forEach(({ name, description, params, handler }) => {
		agent.server.tool(name, description, params, withAccountCheck(agent, handler))
	})
}
