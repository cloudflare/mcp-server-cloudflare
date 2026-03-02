import { z } from 'zod'

import { withAccountCheck } from '@repo/mcp-common/src/api/account.api'
import {
	handleAssetById,
	handleAssetCategories,
	handleAssets,
	handleAssetsByAssetCategoryId,
	handleAssetsByIntegrationId,
	handleAssetsSearch,
	handleIntegrationById,
	handleIntegrations,
} from '@repo/mcp-common/src/api/cf1-integration.api'
import {
	assetCategoryTypeParam,
	assetCategoryVendorParam,
} from '@repo/mcp-common/src/types/cf1-integrations.types'

import type { ToolDefinition } from '@repo/mcp-common/src/types/tools.types'
import type { CASBMCP } from '../cf1-casb.app'

const PAGE_SIZE = 3

const integrationIdParam = z.string().describe('The UUID of the integration to analyze')
const assetSearchTerm = z.string().describe('The search keyword for assets')
const assetIdParam = z.string().describe('The UUID of the asset to analyze')
const assetCategoryIdParam = z.string().describe('The UUID of the asset category to analyze')

const toolDefinitions: Array<ToolDefinition<any>> = [
	{
		name: 'integration_by_id',
		description: 'Analyze Cloudflare One Integration by ID',
		params: { integrationIdParam },
		handler: async ({
			integrationIdParam,
			accountId,
			apiToken,
		}: {
			integrationIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { integration } = await handleIntegrationById({
				integrationIdParam,
				accountId,
				apiToken,
			})
			return { integration }
		},
	},
	{
		name: 'integrations_list',
		description: 'List all Cloudflare One Integrations in a given account',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const { integrations } = await handleIntegrations({ accountId, apiToken })
			return { integrations }
		},
	},
	{
		name: 'assets_search',
		description: 'Search Assets by keyword',
		params: { assetSearchTerm },
		handler: async ({
			assetSearchTerm,
			accountId,
			apiToken,
		}: {
			assetSearchTerm: string
			accountId: string
			apiToken: string
		}) => {
			const { assets } = await handleAssetsSearch({
				accountId,
				apiToken,
				searchTerm: assetSearchTerm,
				pageSize: PAGE_SIZE,
			})
			return { assets }
		},
	},
	{
		name: 'asset_by_id',
		description: 'Search Assets by ID',
		params: { assetIdParam },
		handler: async ({
			assetIdParam,
			accountId,
			apiToken,
		}: {
			assetIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { asset } = await handleAssetById({
				accountId,
				apiToken,
				assetId: assetIdParam,
			})
			return { asset }
		},
	},
	{
		name: 'assets_by_integration_id',
		description: 'Search Assets by Integration ID',
		params: { integrationIdParam },
		handler: async ({
			integrationIdParam,
			accountId,
			apiToken,
		}: {
			integrationIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { assets } = await handleAssetsByIntegrationId({
				accountId,
				apiToken,
				integrationId: integrationIdParam,
				pageSize: PAGE_SIZE,
			})
			return { assets }
		},
	},
	{
		name: 'assets_by_category_id',
		description: 'Search Assets by Asset Category ID',
		params: { assetCategoryIdParam },
		handler: async ({
			assetCategoryIdParam,
			accountId,
			apiToken,
		}: {
			assetCategoryIdParam: string
			accountId: string
			apiToken: string
		}) => {
			const { assets } = await handleAssetsByAssetCategoryId({
				accountId,
				apiToken,
				categoryId: assetCategoryIdParam,
				pageSize: PAGE_SIZE,
			})
			return { assets }
		},
	},
	{
		name: 'assets_list',
		description: 'Paginated list of Assets',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const { assets } = await handleAssets({
				accountId,
				apiToken,
				pageSize: PAGE_SIZE,
			})
			return { assets }
		},
	},
	{
		name: 'asset_categories_list',
		description: 'List Asset Categories',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const { categories } = await handleAssetCategories({
				accountId,
				apiToken,
			})
			return { categories }
		},
	},
	{
		name: 'asset_categories_by_vendor',
		description: 'List asset categories by vendor',
		params: { assetCategoryVendorParam },
		handler: async ({
			assetCategoryVendorParam,
			accountId,
			apiToken,
		}: {
			assetCategoryVendorParam: string
			accountId: string
			apiToken: string
		}) => {
			const { categories } = await handleAssetCategories({
				accountId,
				apiToken,
				vendor: assetCategoryVendorParam,
			})
			return { categories }
		},
	},
	{
		name: 'asset_categories_by_type',
		description: 'Search Asset Categories by type',
		params: { assetCategoryTypeParam },
		handler: async ({
			assetCategoryTypeParam,
			accountId,
			apiToken,
		}: {
			assetCategoryTypeParam?: string
			accountId: string
			apiToken: string
		}) => {
			const { categories } = await handleAssetCategories({
				accountId,
				apiToken,
				type: assetCategoryTypeParam,
			})
			return { categories }
		},
	},
	{
		name: 'asset_categories_by_vendor_and_type',
		description: 'Search Asset Categories by vendor and type',
		params: { assetCategoryTypeParam, assetCategoryVendorParam },
		handler: async ({
			assetCategoryTypeParam,
			assetCategoryVendorParam,
			accountId,
			apiToken,
		}: {
			assetCategoryTypeParam?: string
			assetCategoryVendorParam: string
			accountId: string
			apiToken: string
		}) => {
			const { categories } = await handleAssetCategories({
				accountId,
				apiToken,
				type: assetCategoryTypeParam,
				vendor: assetCategoryVendorParam,
			})
			return { categories }
		},
	},
]

/**
 * Registers the logs analysis tool with the MCP server
 * @param agent The MCP server instance
 */
export function registerIntegrationsTools(agent: CASBMCP) {
	toolDefinitions.forEach(({ name, description, params, handler }) => {
		agent.server.tool(name, description, params, withAccountCheck(agent, handler))
	})
}
