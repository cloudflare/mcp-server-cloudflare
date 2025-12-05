import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'

import type { AccountManagementMCP } from '../index'

export function registerAccountManagementTools(agent: AccountManagementMCP) {
	agent.server.tool(
		'get_members_in_account',
		'Get members in a Cloudflare account',
		{
			page: z.number().min(1).default(1),
			per_page: z.number().min(1).max(100).default(20),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await client.accounts.members.list({
					account_id: accountId,
					page: params.page,
					per_page: params.per_page,
				})

				const { result } = r

				// From results array return the user id, name, and roles array
				// We should not return their email as it is sensitive information
				const members = result.map((member) => {
					return {
						id: member.user?.id,
						name: member.user?.first_name + ' ' + member.user?.last_name,
						roles: member.roles,
						policies: member.policies,
						status: member.status,
					}
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: members,
								result_info: r.result_info,
								page_info: {
									page: params.page,
									per_page: params.per_page,
									has_more: members.length === params.per_page,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting members in account: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'get_roles',
		'List all the available roles in a Cloudflare account',
		{
			page: z.number().min(1).default(1),
			per_page: z.number().min(1).max(100).default(20),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await client.accounts.roles.list({
					account_id: accountId,
					page: params.page,
					per_page: params.per_page,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: r.result,
								result_info: r.result_info,
								page_info: {
									page: params.page,
									per_page: params.per_page,
									has_more: r.result.length === params.per_page,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting roles: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'invite_to_account',
		'Invite a user to a Cloudflare account with at least one role.',
		{
			email: z.string().email(),
			roles: z
				.array(z.string())
				.min(1)
				.describe('Array of role IDs. You can get the roles by using the get_roles tool.'),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await client.accounts.members.create({
					account_id: accountId,
					email: params.email,
					roles: params.roles,
				})

				// From results return the id, name of the user, and roles array
				// We should not return their email as it is sensitive information
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: {
									id: r.user?.id,
									name: r.user?.first_name + ' ' + r.user?.last_name,
									roles: r.roles,
									status: r.status,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error inviting user to account: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'update_member',
		'Update a member in a Cloudflare account',
		{
			member_id: z.string(),
			roles: z.array(z.string()),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await client.accounts.members.update(params.member_id, {
					account_id: accountId,
					roles: params.roles.map((role) => ({ id: role })),
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: {
									id: r.user?.id,
									name: r.user?.first_name + ' ' + r.user?.last_name,
									roles: r.roles,
									status: r.status,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating member: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)

	agent.server.tool(
		'remove_member',
		'Remove a member from a Cloudflare account',
		{
			member_id: z.string(),
		},
		async (params) => {
			const accountId = await agent.getActiveAccountId()
			if (!accountId) {
				return {
					content: [
						{
							type: 'text',
							text: 'No currently active accountId. Try listing your accounts (accounts_list) and then setting an active account (set_active_account)',
						},
					],
				}
			}
			try {
				const client = getCloudflareClient(agent.props.accessToken)
				const r = await client.accounts.members.delete(params.member_id, {
					account_id: accountId,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result: {
									id: r?.id,
									success: true,
								},
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error removing member: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
