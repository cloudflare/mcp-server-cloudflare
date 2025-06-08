import { fetchCloudflareApi } from '../cloudflare-api'
import {
	AssetCategoriesResponse,
	AssetDetail,
	AssetsResponse,
	IntegrationResponse,
	IntegrationsResponse,
} from '../types/cf1-integrations.types'
import { V4Schema } from '../v4-api'

import type { z } from 'zod'
import type {
	zReturnedAssetCategoriesResult,
	zReturnedAssetsResult,
	zReturnedIntegrationResult,
	zReturnedIntegrationsResult,
} from '../types/cf1-integrations.types'

interface BaseParams {
	accountId: string
	apiToken: string
}

interface PaginationParams {
	page?: number
	pageSize?: number
}

type IntegrationParams = BaseParams & { integrationIdParam: string }
type AssetCategoryParams = BaseParams & { type?: string; vendor?: string }
type AssetSearchParams = BaseParams & { searchTerm: string } & PaginationParams
type AssetByIdParams = BaseParams & { assetId: string }
type AssetByCategoryParams = BaseParams & { categoryId: string } & PaginationParams
type AssetByIntegrationParams = BaseParams & { integrationId: string } & PaginationParams

const buildParams = (baseParams: Record<string, string>, pagination?: PaginationParams) => {
	const params = new URLSearchParams(baseParams)
	if (pagination?.page) params.append('page', String(pagination.page))
	if (pagination?.pageSize) params.append('page_size', String(pagination.pageSize))
	return params
}

const buildIntegrationEndpoint = (integrationId: string) => `/casb/integrations/${integrationId}`
const buildAssetEndpoint = (assetId?: string) =>
	assetId ? `/casb/assets/${assetId}` : '/casb/assets'
const buildAssetCategoryEndpoint = () => '/casb/asset_categories'

const makeApiCall = async <T>({
	endpoint,
	accountId,
	apiToken,
	responseSchema,
	params,
}: {
	endpoint: string
	accountId: string
	apiToken: string
	responseSchema: z.ZodType<any>
	params?: URLSearchParams
}): Promise<T> => {
	try {
		const fullEndpoint = params ? `${endpoint}?${params.toString()}` : endpoint
		const data = await fetchCloudflareApi({
			endpoint: fullEndpoint,
			accountId,
			apiToken,
			responseSchema,
			options: {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			},
		})
		return data.result as T
	} catch (error) {
		console.error(`API call failed for ${endpoint}:`, error)
		throw error
	}
}

// Resource-specific API call handlers
const makeIntegrationCall = <T>(params: IntegrationParams, responseSchema: z.ZodType<any>) =>
	makeApiCall<T>({
		endpoint: buildIntegrationEndpoint(params.integrationIdParam),
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema,
	})

const makeAssetCall = <T>(
	params: BaseParams & PaginationParams,
	responseSchema: z.ZodType<any>,
	assetId?: string,
	additionalParams?: Record<string, string>
) =>
	makeApiCall<T>({
		endpoint: buildAssetEndpoint(assetId),
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema,
		params: buildParams(additionalParams || {}, params),
	})

const makeAssetCategoryCall = <T>(params: AssetCategoryParams, responseSchema: z.ZodType<any>) =>
	makeApiCall<T>({
		endpoint: buildAssetCategoryEndpoint(),
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema,
		params: buildParams({
			...(params.vendor && { vendor: params.vendor }),
			...(params.type && { type: params.type }),
		}),
	})

// Integration handlers
export async function handleIntegrationById(
	params: IntegrationParams
): Promise<{ integration: zReturnedIntegrationResult | null }> {
	const integration = await makeIntegrationCall<zReturnedIntegrationResult>(
		params,
		V4Schema(IntegrationResponse)
	)
	return { integration }
}

export async function handleIntegrations(
	params: BaseParams
): Promise<{ integrations: zReturnedIntegrationsResult | null }> {
	const integrations = await makeApiCall<zReturnedIntegrationsResult>({
		endpoint: '/casb/integrations',
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema: V4Schema(IntegrationsResponse),
	})
	return { integrations }
}

// Asset category handlers
export async function handleAssetCategories(
	params: AssetCategoryParams
): Promise<{ categories: zReturnedAssetCategoriesResult | null }> {
	const categories = await makeAssetCategoryCall<zReturnedAssetCategoriesResult>(
		params,
		V4Schema(AssetCategoriesResponse)
	)
	return { categories }
}

// Asset handlers
export async function handleAssets(params: BaseParams & PaginationParams) {
	const assets = await makeAssetCall<zReturnedAssetsResult>(params, V4Schema(AssetsResponse))
	return { assets }
}

export async function handleAssetsByIntegrationId(params: AssetByIntegrationParams) {
	const assets = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ integration_id: params.integrationId }
	)
	return { assets }
}

export async function handleAssetById(params: AssetByIdParams) {
	const asset = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetDetail),
		params.assetId
	)
	return { asset }
}

export async function handleAssetsByAssetCategoryId(params: AssetByCategoryParams) {
	const assets = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ category_id: params.categoryId }
	)
	return { assets }
}

export async function handleAssetsSearch(params: AssetSearchParams) {
	const assets = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ search: params.searchTerm }
	)
	return { assets }
}
