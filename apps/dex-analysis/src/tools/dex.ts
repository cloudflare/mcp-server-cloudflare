import { z } from 'zod'

import { fetchDexTestAnalyzation, fetchDexTests } from '../api/dex'

import type { CloudflareDEXMCP } from '../index'

// DEX parameter schema
const dexTestIdParam = z.string().describe('The DEX Test ID to analyze details of.')
const dexTestTimeStart = z
	.string()
	.describe(
		'The datetime of the beginning point of time range for DEX test analyzation. Must be in ISO 8601 datetime string in the extended format with UTC time (e.g, 2025-04-21T18:00:00Z).'
	)
const dexTestTimeEnd = z
	.string()
	.describe(
		'The datetime of the ending point of time range for DEX test analyzation. Must be in ISO 8601 datetime string in the extended format with UTC time (e.g, 2025-04-22T00:00:00Z).'
	)

export function registerDEXTools(agent: CloudflareDEXMCP) {
	// Register the dex test analysis tool by test id
	agent.server.tool(
		'dex_test_statistics',
		'Analyze Cloudflare DEX Test Results given a Test ID',
		{
			dexTestId: dexTestIdParam,
			timeStart: dexTestTimeStart,
			timeEnd: dexTestTimeEnd,
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
				const { dexTestId, timeStart, timeEnd } = params
				const accessToken = agent.props.accessToken
				const data = await fetchDexTestAnalyzation({
					dexTestId,
					accountId,
					accessToken,
					timeStart,
					timeEnd,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								data,
								llmContext:
									"The quartiles are sorted by 'resource fetch time' from LEAST performant in quartile 1 to MOST performant in quartile 4. For each quartile-based entry, it provides extensive information about the up-to-20 specific test results that are within that quartile of performance.",
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error retreiving DEX HTTP Tests: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)

	// Register the dex test analysis tool by test id
	agent.server.tool(
		'dex_list_tests',
		'Retrieve a list of all Cloudflare DEX Tests configured.',
		{},
		async () => {
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
				const accessToken = agent.props.accessToken
				const data = await fetchDexTests({ accountId, accessToken })
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								data,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: `Error retreiving DEX Tests: ${error instanceof Error && error.message}`,
							}),
						},
					],
				}
			}
		}
	)
}
