import { z } from 'zod'

import { handleZonesList } from '../api/zone.api'
import { getCloudflareClient } from '../cloudflare-api'
import { getProps } from '../get-props'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'

export function registerZoneTools(agent: CloudflareMcpAgent) {
	// Tool to list all zones under an account
	agent.server.tool(
		'zones_list',
		'List all DNS zones configured under your Cloudflare account. Use when the user wants to view, audit, or manage their domain zones across the account. Do not use when you need to work with a specific account (use set_active_account instead). Accepts `account_id` (optional) to override the active account context. e.g., returns zones like "example.com", "mysite.org", or "api.company.net". Raises an error if no active account is set or if API authentication fails.'s resources (use set_active_account first). Accepts `account_id` (optional, uses active account if not specified). e.g., returns zones like "example.com", "mysite.org" with their status and settings. Raises an error if no active account is set or if API authentication fails.',
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
		'Get detailed information about a specific Cloudflare zone including settings, status, and configuration. Use when the user wants to inspect or review properties of an existing zone such as DNS settings, security configurations, or zone metadata. Do not use when you need to list all zones (use zones_list instead). Accepts `zone_id` (required string), e.g., "023e105f4ecef8ad9ca31a8372d0c353". Raises an error if the zone ID is invalid or you lack access permissions to the zone. "023e105f4ecef8ad9ca31a8372d0c353". Do not use when you need to list all zones in an account (use a zones listing tool instead). Raises an error if the zone ID does not exist or you lack permission to access it.',
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
