import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { AccountGetParams } from 'cloudflare/resources/accounts/accounts.mjs'
import type { ReportGetParams } from 'cloudflare/resources/dns/analytics.mjs'
import type { ZoneGetParams } from 'cloudflare/resources/dns/settings.mjs'
import type { DNSAnalyticsMCP } from '../dns-analytics.app'

function getStartDate(days: number) {
	const today = new Date()
	const start_date = new Date(today.setDate(today.getDate() - days))
	return start_date.toISOString()
}

export function registerAnalyticTools(agent: DNSAnalyticsMCP) {
	// Register DNS Report tool
	agent.server.tool(
		'dns_report',
		'Fetch DNS analytics and query statistics for a Cloudflare DNS zone within a specified time period. Use when the user wants to analyze DNS traffic patterns, query volumes, or troubleshoot DNS performance issues for a specific zone. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `zone_id` (required) and `since` (required date parameter). e.g., zone_id="abc123def456", since="2024-01-01T00:00:00Z". Raises an error if the zone_id is invalid or the account lacks access to the specified zone."abc123def456", since="2024-01-01". Do not use when you need real-time DNS record lookups or modifications (use other DNS management tools instead). Raises an error if the zone ID is invalid or the date format is incorrect.',
		{
			zone: z.string(),
			days: z.number(),
		},
		async ({ zone, days }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const start_date = getStartDate(days)
				const params: ReportGetParams = {
					zone_id: zone,
					metrics: 'responseTimeAvg,queryCount,uncachedCount,staleCount',
					dimensions: 'responseCode,responseCached',
					since: start_date,
				}
				const result = await client.dns.analytics.reports.get(params)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error fetching DNS report: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
	// Register Account DNS Settings display tool
	agent.server.tool(
		'show_account_dns_settings',
		'Display DNS configuration and settings for the currently active Cloudflare account. Use when the user wants to review DNS zones, records, or account-level DNS preferences and configurations. Do not use when you need to switch between accounts (use set_active_account instead) or list all available accounts (use accounts_list instead). Accepts no required parameters as it operates on the currently active account. e.g., shows DNS zones, nameservers, and account DNS policies. Raises an error if no account is currently set as active.',
		async () => {
			try {
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
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const params: AccountGetParams = {
					account_id: accountId,
				}
				const result = await client.dns.settings.account.get(params)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error fetching DNS report: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
	// Register Zone DNS Settings display tool
	agent.server.tool(
		'show_zone_dns_settings',
		'Show DNS settings and configuration details for a specific Cloudflare zone. Use when the user wants to review current DNS configuration, check nameservers, or inspect zone-level DNS policies. Do not use when you need to search general Cloudflare documentation (use search_cloudflare_documentation instead). Accepts `zone_id` (required) to identify the target zone, e.g., zone_id="abc123def456". Raises an error if the zone_id is invalid or you lack access permissions to the zone."abc123def456" for a specific domain's DNS settings. Returns error if the zone does not exist or account lacks permissions. Do not use when you need to modify DNS records or create new zones (use appropriate DNS record management tools instead).',
		{
			zone: z.string(),
		},
		async ({ zone }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const params: ZoneGetParams = {
					zone_id: zone,
				}
				const result = await client.dns.settings.zone.get(params)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								result,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error fetching DNS report: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
