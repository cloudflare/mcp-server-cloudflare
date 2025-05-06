import { z } from 'zod'

import { withAccountCheck } from '@repo/mcp-common/src/api/account'
import {
	handleAssetById,
	handleAssetCategories,
	handleAssets,
	handleAssetsByAssetCategoryId,
	handleAssetsByIntegrationId,
	handleAssetsSearch,
	handleIntegrationById,
	handleIntegrations,
} from '@repo/mcp-common/src/api/cf1-integration'
import {
	assetCategoryTypeParam,
	assetCategoryVendorParam,
} from '@repo/mcp-common/src/schemas/cf1-integrations'

import type { zReturnedAssetResult } from '@repo/mcp-common/src/schemas/cf1-integrations'
import type { ToolDefinition } from '@repo/mcp-common/src/types/tools'
import type { CASBMCP } from '../index'

const integrationIdParam = z.string().describe('The UUID of the integration to analyze')
const assetSearchTerm = z.string().describe('The search keyword for assets')
const assetIdParam = z.string().describe('The UUID of the asset to analyze')
const assetCategoryIdParam = z.string().describe('The UUID of the asset category to analyze')

const paginationParams = z
	.object({
		page: z.number().optional().describe('Page number for pagination'),
		pageSize: z.number().optional().describe('Number of items per page'),
	})
	.optional()

const assetLite = ({ fields: _, integration, ...asset }: zReturnedAssetResult) => ({
	...asset,
	integration: {
		id: integration.id,
		name: integration.name,
	},
})

const toolDefinitions: Array<ToolDefinition<any>> = [
	{
		name: 'integration_by_id',
		description: 'Analyze Cloudflare One Integration by ID',
		params: { integrationIdParam, paginationParams },
		handler: async ({
			integrationIdParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			integrationIdParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { integration } = await handleIntegrationById({
				integrationIdParam,
				accountId,
				apiToken,
				...paginationParams,
			})
			return { integration }
		},
	},
	{
		name: 'integrations_list',
		description: 'List all Cloudflare One Integrations in a given account',
		params: { paginationParams },
		handler: async ({
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { integrations, result_info } = await handleIntegrations({
				accountId,
				apiToken,
				...paginationParams,
			})
			return { integrations, result_info }
		},
	},
	{
		name: 'assets_search',
		description: 'Search Assets by keyword',
		params: { assetSearchTerm, paginationParams },
		handler: async ({
			assetSearchTerm,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetSearchTerm: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { assets, result_info } = await handleAssetsSearch({
				accountId,
				apiToken,
				searchTerm: assetSearchTerm,
				...paginationParams,
			})
			return { assets: assets.map(assetLite), result_info }
		},
	},
	{
		name: 'asset_by_id',
		description: 'Search Assets by ID',
		params: { assetIdParam, paginationParams },
		handler: async ({
			assetIdParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetIdParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { asset } = await handleAssetById({
				accountId,
				apiToken,
				assetId: assetIdParam,
				...paginationParams,
			})
			return { asset }
		},
	},
	{
		name: 'assets_by_integration_id',
		description: 'Search Assets by Integration ID',
		params: { integrationIdParam, paginationParams },
		handler: async ({
			integrationIdParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			integrationIdParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { assets, result_info } = await handleAssetsByIntegrationId({
				accountId,
				apiToken,
				integrationId: integrationIdParam,
				...paginationParams,
			})
			return { assets: assets.map(assetLite), result_info }
		},
	},
	{
		name: 'assets_by_category_id',
		description: 'Search Assets by Asset Category ID',
		params: { assetCategoryIdParam, paginationParams },
		handler: async ({
			assetCategoryIdParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetCategoryIdParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { assets, result_info } = await handleAssetsByAssetCategoryId({
				accountId,
				apiToken,
				categoryId: assetCategoryIdParam,
				...paginationParams,
			})
			return { assets: assets.map(assetLite), result_info }
		},
	},
	{
		name: 'assets_list',
		description: 'Paginated list of Assets',
		params: { paginationParams },
		handler: async ({
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) => {
			const { assets, result_info } = await handleAssets({
				accountId,
				apiToken,
				...paginationParams,
			})
			return { assets: assets.map(assetLite), result_info }
		},
	},
	{
		name: 'asset_categories_list',
		description: 'List Asset Categories',
		params: { paginationParams },
		handler: async ({
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) =>
			await handleAssetCategories({
				accountId,
				apiToken,
				...paginationParams,
			}),
	},
	{
		name: 'asset_categories_by_vendor',
		description: 'List asset categories by vendor',
		params: { assetCategoryVendorParam, paginationParams },
		handler: async ({
			assetCategoryVendorParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetCategoryVendorParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) =>
			await handleAssetCategories({
				accountId,
				apiToken,
				vendor: assetCategoryVendorParam,
				...paginationParams,
			}),
	},
	{
		name: 'asset_categories_by_type',
		description: 'Search Asset Categories by type',
		params: { assetCategoryTypeParam, paginationParams },
		handler: async ({
			assetCategoryTypeParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetCategoryTypeParam?: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) =>
			await handleAssetCategories({
				accountId,
				apiToken,
				type: assetCategoryTypeParam,
				...paginationParams,
			}),
	},
	{
		name: 'asset_categories_by_vendor_and_type',
		description: 'Search Asset Categories by vendor and type',
		params: { assetCategoryTypeParam, assetCategoryVendorParam, paginationParams },
		handler: async ({
			assetCategoryTypeParam,
			assetCategoryVendorParam,
			accountId,
			apiToken,
			paginationParams = {},
		}: {
			assetCategoryTypeParam?: string
			assetCategoryVendorParam: string
			accountId: string
			apiToken: string
			paginationParams?: { page?: number; pageSize?: number }
		}) =>
			await handleAssetCategories({
				accountId,
				apiToken,
				type: assetCategoryTypeParam,
				vendor: assetCategoryVendorParam,
				...paginationParams,
			}),
	},
]

export function registerIntegrationsTools(agent: CASBMCP) {
	toolDefinitions.forEach(({ name, description, params, handler }) => {
		agent.server.tool(name, description, params, withAccountCheck(agent, handler))
	})
}
