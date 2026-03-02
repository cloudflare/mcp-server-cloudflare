import { z } from 'zod'

import { handleZonesList } from '../api/zone.api'
import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

export function registerZoneTools(agent: CloudflareMcpAgent) {
	// Tool to list all zones under an account
	agent.server.tool(
		'zones_list',
		'List all zones under a Cloudflare account',
		{
			name: z.string().optional().describe('Filter zones by name'),
			status: z
				.string()
				.optional()
				.describe(
					'Filter zones by status (active, pending, initializing, moved, deleted, deactivated, read only)'
				),
			page: z.number().min(1).default(1).describe('Page number for pagination'),
			perPage: z.number().min(5).max(1000).default(50).describe('Number of zones per page'),
			order: z
				.string()
				.default('name')
				.describe('Field to order results by (name, status, account_name)'),
			direction: z
				.enum(['asc', 'desc'])
				.default('desc')
				.describe('Direction to order results (asc, desc)'),
		},
		{
			title: 'List zones',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
			},
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
				const props = getProps(agent)
				const { page = 1, perPage = 50 } = params

				const zones = await handleZonesList({
					client: getCloudflareClient(props.accessToken),
					accountId,
					...params,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								zones,
								count: zones.length,
								page,
								perPage,
								accountId,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing zones: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Tool to get zone details by ID
	agent.server.tool(
		'zone_details',
		'Get details for a specific Cloudflare zone',
		{
			zoneId: z.string().describe('The ID of the zone to get details for'),
		},
		{
			title: 'Get zone details',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
			},
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
				const props = getProps(agent)
				const { zoneId } = params
				const client = getCloudflareClient(props.accessToken)

				// Use the zones.get method to fetch a specific zone
				const response = await client.zones.get({ zone_id: zoneId })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								zone: response,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error fetching zone details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
