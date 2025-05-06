import { fetchCloudflareApi } from '../cloudflare-api'
import {
	AssetCategoriesResponse,
	AssetDetail,
	AssetsResponse,
	IntegrationResponse,
	IntegrationsResponse,
} from '../schemas/cf1-integrations'
import { V4Schema } from '../v4-api'

import type { z } from 'zod'
import type {
	zReturnedAssetCategoriesResult,
	zReturnedAssetResult,
	zReturnedAssetsResult,
	zReturnedIntegrationResult,
	zReturnedIntegrationsResult,
} from '../schemas/cf1-integrations'
import type { zV4ResultInfoSchema } from '../v4-api'

const DEFAULT_PAGE_SIZE = 3

interface BaseParams {
	accountId: string
	apiToken: string
}

interface PaginationParams {
	page?: number
	pageSize?: number
}

type IntegrationParams = BaseParams & { integrationIdParam: string } & PaginationParams
type AssetCategoryParams = BaseParams & { type?: string; vendor?: string } & PaginationParams
type AssetSearchParams = BaseParams & { searchTerm: string } & PaginationParams
type AssetByIdParams = BaseParams & { assetId: string } & PaginationParams
type AssetByCategoryParams = BaseParams & { categoryId: string } & PaginationParams
type AssetByIntegrationParams = BaseParams & { integrationId: string } & PaginationParams

const buildParams = (baseParams: Record<string, string>, pagination: PaginationParams = {}) => {
	const params = new URLSearchParams(baseParams)
	const pageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE

	if (pagination.page) params.append('page', String(pagination.page))
	params.append('page_size', String(pageSize))

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
}): Promise<{ result: T; result_info: zV4ResultInfoSchema }> => {
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
		return data
	} catch (error) {
		console.error(`API call failed for ${endpoint}:`, error)
		throw error
	}
}

const makeIntegrationCall = <T>(params: IntegrationParams, responseSchema: z.ZodType<any>) =>
	makeApiCall<T>({
		endpoint: buildIntegrationEndpoint(params.integrationIdParam),
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema,
		params: buildParams({}, params),
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
		params: buildParams(
			{
				...(params.vendor && { vendor: params.vendor }),
				...(params.type && { type: params.type }),
			},
			params
		),
	})

export async function handleIntegrationById(
	params: IntegrationParams
): Promise<{ integration: zReturnedIntegrationResult | null; result_info: zV4ResultInfoSchema }> {
	const data = await makeIntegrationCall<zReturnedIntegrationResult>(
		params,
		V4Schema(IntegrationResponse)
	)
	return { integration: data.result, result_info: data?.result_info }
}

export async function handleIntegrations(
	params: BaseParams & PaginationParams
): Promise<{ integrations: zReturnedIntegrationsResult | null; result_info: zV4ResultInfoSchema }> {
	const data = await makeApiCall<zReturnedIntegrationsResult>({
		endpoint: '/casb/integrations',
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema: V4Schema(IntegrationsResponse),
		params: buildParams({}, params),
	})

	return { integrations: data.result, result_info: data?.result_info }
}

export async function handleAssetCategories(params: AssetCategoryParams): Promise<{
	categories: zReturnedAssetCategoriesResult | null
	result_info: zV4ResultInfoSchema
}> {
	const { result: categories, result_info } =
		await makeAssetCategoryCall<zReturnedAssetCategoriesResult>(
			params,
			V4Schema(AssetCategoriesResponse)
		)

	return { categories, result_info }
}

export async function handleAssets(params: BaseParams & PaginationParams) {
	const { result: assets, result_info } = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse)
	)

	return { assets, result_info }
}

export async function handleAssetsByIntegrationId(params: AssetByIntegrationParams) {
	const { result: assets, result_info } = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ integration_id: params.integrationId }
	)

	return { assets, result_info }
}

export async function handleAssetById(params: AssetByIdParams) {
	const asset = await makeAssetCall<zReturnedAssetResult>(
		params,
		V4Schema(AssetDetail),
		params.assetId
	)
	return { asset }
}

export async function handleAssetsByAssetCategoryId(params: AssetByCategoryParams) {
	const data = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ category_id: params.categoryId }
	)
	return { assets: data.result, result_info: data.result_info }
}

export async function handleAssetsSearch(
	params: AssetSearchParams
): Promise<{ assets: zReturnedAssetsResult; result_info: zV4ResultInfoSchema }> {
	const data = await makeAssetCall<zReturnedAssetsResult>(
		params,
		V4Schema(AssetsResponse),
		undefined,
		{ search: params.searchTerm }
	)

	return { assets: data.result, result_info: data?.result_info }
}
