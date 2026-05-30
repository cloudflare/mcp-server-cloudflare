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
		description: 'Analyze a specific Cloudflare One Integration by its unique identifier to retrieve detailed configuration, status, and settings. Use when the user wants to inspect or troubleshoot a particular integration's setup, connection status, or configuration details. Accepts `integration_id` (required), e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479". Do not use when you need to list all available integrations (use a list integrations tool instead). Raises an error if the integration ID does not exist or access is denied.'s properties, connection details, or operational status. Accepts `integration_id` (required string), e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890". Do not use when you need to list all available integrations (use a general listing tool instead). Raises an error if the integration ID does not exist or you lack permissions to access it.',
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
		description: 'List all Cloudflare One Integrations configured in a specified Cloudflare account. Use when the user wants to review, audit, or manage existing security integrations and identity providers. Accepts `account_id` (required) to specify which account to query. e.g., account_id="f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6". Do not use when you need to view general account information (use accounts_list instead). Raises an error if the account ID is invalid or you lack permissions to access Cloudflare One settings.',
		params: {},
		handler: async ({ accountId, apiToken }: { accountId: string; apiToken: string }) => {
			const { integrations } = await handleIntegrations({ accountId, apiToken })
			return { integrations }
		},
	},
	{
		name: 'assets_search',
		description: 'Search for Cloudflare assets by keyword across your account. Use when the user wants to find specific resources, services, or configurations by name or description. Accepts `keyword` (required string) to match against asset names, descriptions, or metadata, e.g., "worker-api" or "production-bucket". Do not use when you need to list all assets of a specific type (use the dedicated list tools like r2_buckets_list or d1_databases_list instead). Returns error if the search keyword is empty or the account context is not set.',
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
		description: 'Retrieve detailed information about a specific Cloudflare asset using its unique identifier. Use when the user wants to inspect properties, configuration, or metadata of a particular asset they already know the ID for. Accepts `asset_id` (required string), e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890". Do not use when you need to search for assets by name or list all available assets (use appropriate listing tools instead). Returns error if the asset ID does not exist or you lack permissions to access it.',
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
		description: 'Search for assets associated with a specific integration identifier in your Cloudflare account. Use when the user wants to find or filter assets that belong to a particular integration or service connection. Accepts `integration_id` (required string), e.g., "abc123-def456-ghi789". Do not use when you need to list all assets without filtering (use a general asset listing tool instead). Returns an error if the integration ID does not exist or you lack permissions to view the associated assets.',
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
		description: 'Search for assets filtered by a specific asset category identifier. Use when the user wants to find or retrieve assets that belong to a particular category within their Cloudflare account. Accepts `category_id` (required) to filter results by the asset category. e.g., category_id="web-security" or category_id="performance-tools". Returns an error if the category ID does not exist or is invalid. Do not use when you need to list all available asset categories (use a category listing tool instead).',
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
		description: 'List all assets in your Cloudflare account with pagination support. Use when the user wants to browse, review, or inventory their Cloudflare assets across services. Accepts `page` (optional, integer for pagination) and `per_page` (optional, number of results per page). e.g., page=2, per_page=50 to get the second page with 50 assets. Returns an error if the account lacks proper permissions to view assets. Do not use when you need details about a specific asset type like D1 databases or R2 buckets (use their respective list tools instead).',
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
		description: 'List all available asset categories in your Cloudflare account. Use when the user wants to browse or review the different types of assets that can be managed within Cloudflare services. Do not use when you need to list specific assets within a category (use the appropriate asset-specific list tool instead). Accepts optional filtering parameters such as `account_id` if multiple accounts are configured. e.g., retrieving categories like "domains", "workers", "pages", or "r2_buckets". Raises an error if the active account is not properly configured or lacks sufficient permissions.',
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
		description: 'List asset categories organized by vendor in your Cloudflare account. Use when the user wants to browse or review available asset types grouped by their respective vendors. Accepts `vendor` (optional filter) and `category_type` (optional filter). e.g., vendor="cloudflare" or category_type="security". Returns an error if the account lacks proper permissions to view asset categories. Do not use when you need to list specific assets within a category (use a dedicated asset listing tool instead).',
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
		description: 'Search asset categories filtered by a specific type within your Cloudflare account. Use when the user wants to find or browse asset categories that match a particular classification or category type. Accepts `type` (required string) to filter categories, e.g., "security" or "performance". Do not use when you need to list all asset categories without filtering (use a general asset listing tool instead). Raises an error if the specified type does not exist or if account access is insufficient.',
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
		description: 'Search asset categories filtered by vendor and type within your Cloudflare account. Use when the user wants to find specific asset categories based on vendor name or asset type criteria. Accepts `vendor` (optional string) and `type` (optional string) parameters for filtering results. e.g., vendor="Microsoft" or type="software". Returns an error if the account context is not properly set. Do not use when you need to list all accounts or set the active account (use accounts_list or set_active_account instead).',
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
