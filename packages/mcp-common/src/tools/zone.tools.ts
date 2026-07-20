import { z } from 'zod'

import { handleZonesList } from '../api/zone.api'
import { getCloudflareClient } from '../cloudflare-api'
import { requireRequestProps } from '../request-context'

import type { McpRegistrationContext } from '../request-context'

export function registerZoneTools<Env>(context: McpRegistrationContext<Env>) {
	// Tool to list all zones under an account
	context.server.accountTool(
		'zones_list',
		{
			description: 'List all zones under a Cloudflare account',
			inputSchema: z.object({
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
			}),
			annotations: {
				title: 'List zones',
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async (params, accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)

	// Tool to get zone details by ID
	context.server.accountTool(
		'zone_details',
		{
			description: 'Get details for a specific Cloudflare zone',
			inputSchema: z.object({
				zoneId: z.string().describe('The ID of the zone to get details for'),
			}),
			annotations: {
				title: 'Get zone details',
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async (params, _accountId) => {
			try {
				const props = requireRequestProps(context)
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
					isError: true,
				}
			}
		}
	)
}
