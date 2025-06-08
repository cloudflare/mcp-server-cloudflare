import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'

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
		'Fetch the DNS Report for a given zone since a date',
		{
			zone: z.string(),
			days: z.number(),
		},
		async ({ zone, days }) => {
			try {
				const client = getCloudflareClient(agent.props.accessToken)
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
		'Show DNS settings for current account',
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
				const client = getCloudflareClient(agent.props.accessToken)
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
		'Show DNS settings for a zone',
		{
			zone: z.string(),
		},
		async ({ zone }) => {
			try {
				const client = getCloudflareClient(agent.props.accessToken)
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
