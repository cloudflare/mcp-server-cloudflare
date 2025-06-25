import { z } from 'zod'

import { withAccountCheck } from '@repo/mcp-common/src/api/account.api'
import {
	handleFindingInstances,
	handleFindingRemediationByFindingTypeId,
	handleFindingsSearch,
} from '@repo/mcp-common/src/api/cf1-posture.api'

import type { ToolDefinition } from '@repo/mcp-common/src/types/tools.types'
import type { CASBMCP } from '../cf1-casb.app'

const PAGE_SIZE = 3

// const integrationIdParam = z.string().describe('The UUID of the integration to analyze')
const findingsSearchTerm = z.string().optional().describe('The search keyword for findings')
const findingIdParam = z.string().describe('The UUID of the Finding')
const findingTypeIdParam = z.string().describe('The UUID of the Finding Type')
// const assetCategoryIdParam = z.string().describe('The UUID of the asset category to analyze')

const toolDefinitions: Array<ToolDefinition<any>> = [
	{
		name: 'posture_findings_search',
		description: 'Search Posture Findings by keyword',
		params: { findingsSearchTerm },
		handler: async ({
			findingsSearchTerm,
			accountId,
			apiToken,
		}: {
			findingsSearchTerm: string
			accountId: string
			apiToken: string
		}) => {
			const { findings } = await handleFindingsSearch({
				accountId,
				apiToken,
				searchTerm: findingsSearchTerm,
				pageSize: PAGE_SIZE,
			})
			return { findings }
		},
	},
	{
		name: 'posture_findings_instances',
		description: 'Get Finding Instances by Finding ID',
		params: { findingIdParam },
		handler: async ({
			findingIdParam,
			accountId,
			apiToken,
		}: {
			findingIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { instances } = await handleFindingInstances({
				accountId,
				apiToken,
				findingIdParam,
			})
			return { instances }
		},
	},
	{
		name: 'posture_findings_remediation_guide_by_finding_type_id',
		description: 'Get Remediation Guide by Finding Type ID',
		params: { findingTypeIdParam },
		handler: async ({
			findingTypeIdParam,
			accountId,
			apiToken,
		}: {
			findingTypeIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { remediationGuide } = await handleFindingRemediationByFindingTypeId({
				accountId,
				apiToken,
				findingTypeIdParam,
			})
			return { remediationGuide }
		},
	},
]

/**
 * Registers the logs analysis tool with the MCP server
 * @param agent The MCP server instance
 */
export function registerFindingsTools(agent: CASBMCP) {
	toolDefinitions.forEach(({ name, description, params, handler }) => {
		agent.server.tool(name, description, params, withAccountCheck(agent, handler))
	})
}
