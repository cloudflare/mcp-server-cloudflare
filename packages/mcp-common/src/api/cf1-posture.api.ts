import { FindingInstancesResponse, FindingsResponse } from '../types/cf1-posture.types'
import { V4Schema } from '../v4-api'
import { makeApiCall } from './cf1-integration.api'

import type { z } from 'zod'
import type {
	zReturnedFindingInstancesResult,
	zReturnedFindingsResult,
} from '../types/cf1-posture.types'

interface BaseParams {
	accountId: string
	apiToken: string
}

interface PaginationParams {
	page?: number
	pageSize?: number
}

type FindingSearchParams = BaseParams & { searchTerm?: string } & PaginationParams
type FindingInstancesParams = BaseParams & { findingIdParam?: string } & PaginationParams

const buildParams = (baseParams: Record<string, string>, pagination?: PaginationParams) => {
	const params = new URLSearchParams(baseParams)
	if (pagination?.page) params.append('page', String(pagination.page))
	if (pagination?.pageSize) params.append('page_size', String(pagination.pageSize))
	return params
}

const buildFindingsEndpoint = (findingId?: string) =>
	findingId
		? `/data-security/posture/findings/${findingId}/instances`
		: '/data-security/posture/findings'

const makeFindingsCall = <T>(
	params: BaseParams & PaginationParams,
	responseSchema: z.ZodType<any>,
	findingId?: string,
	additionalParams?: Record<string, string>
) =>
	makeApiCall<T>({
		endpoint: buildFindingsEndpoint(findingId),
		accountId: params.accountId,
		apiToken: params.apiToken,
		responseSchema,
		params: buildParams(additionalParams || {}, params),
	})

export async function handleFindingsSearch(params: FindingSearchParams) {
	const findings = await makeFindingsCall<zReturnedFindingsResult>(
		params,
		V4Schema(FindingsResponse),
		undefined,
		{ search: params.searchTerm || '' }
	)
	return { findings }
}

export async function handleFindingInstances(params: FindingInstancesParams) {
	const instances = await makeFindingsCall<zReturnedFindingInstancesResult>(
		params,
		V4Schema(FindingInstancesResponse),
		params.findingIdParam
		// { search: params.searchTerm || '' }
	)
	return { instances }
}

const FINDING_TYPE_IDS = {
	MICROSOFT: {
		FOLDER_PUBLIC: {
			RW: {
				CORE: 'c9662c5c-c3d6-453b-9367-281e024f7e7a',
			},
		},
		FILE_PUBLIC: {
			RO: {
				CORE: 'a2b40dc9-b96a-4ace-b8f8-739c2be37dbd',
				DLP: '8150f237-576d-4b48-8839-0c257f612171',
			},
			RW: {
				CORE: '85241e6b-205f-4de6-a1d1-325656130995',
				DLP: '7b6ecb52-852f-4184-bf19-175fe59202b7',
			},
		},
		FILE_COMPANY_WIDE: {
			RW: {
				CORE: 'a81a79c8-a0bf-4c60-aa46-7547b4d34266',
				DLP: 'f838ec6b-7d7a-4c1c-9c61-958ac24c27fa',
			},
		},
	},
}

const REMEDIATION_GUIDES = {
	REMOVE_SHARED_LINKS: `
	To fix this finding you'll need to investigate the permissions, specifically the sharing links associated with this file.
	
	Investigate the asset fields, look for permissions. 

	Investigate each file permission, and generate an API request that shows how to delete or remove the sharing link.

	Here are some options to make the api call to \`https://graph.microsoft.com/v1.0\`:
	
	Path:
	\`\`\`
	DELETE /drives/{drive-id}/items/{item-id}/permissions/{perm-id}
	\`\`\`

	Investigate all the fields under \`permissions\` that would be candidates for this file being public and list the delete options
	
	- For public-facing files, we should remove all shared links with link_scope = 'anonymous', link_type='edit' for RW findings and link_type='view' for RO findings.
	- For company-wide files, we should remove all shared links with link_scope = 'organization', link_type='edit' for RW findings and link_type='view' for RO findings.
	- DLP-based findings adhere to the same principles.


	An example full path may look like:
	\`https://graph.microsoft.com/v1.0/drives/MyDriveID123/items/MyItemID123/permissions/MyPermissionID123\`
	`,
}

const REMEDIATION_GUIDES_BY_FINDING_TYPE_ID = {
	[FINDING_TYPE_IDS.MICROSOFT.FILE_PUBLIC.RO.CORE]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
	[FINDING_TYPE_IDS.MICROSOFT.FILE_PUBLIC.RO.DLP]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
	[FINDING_TYPE_IDS.MICROSOFT.FILE_PUBLIC.RW.CORE]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
	[FINDING_TYPE_IDS.MICROSOFT.FILE_PUBLIC.RW.DLP]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
	[FINDING_TYPE_IDS.MICROSOFT.FILE_COMPANY_WIDE.RW.CORE]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
	[FINDING_TYPE_IDS.MICROSOFT.FILE_COMPANY_WIDE.RW.DLP]: REMEDIATION_GUIDES.REMOVE_SHARED_LINKS,
}

type FindingRemediationParams = BaseParams & { findingTypeIdParam: string }
// Integration handlers
export async function handleFindingRemediationByFindingTypeId(
	params: FindingRemediationParams
): Promise<{ remediationGuide: string | undefined }> {
	// const integration = await makeIntegrationCall<zReturnedIntegrationResult>(
	// 	params,
	// 	V4Schema(IntegrationResponse)
	// )
	// return { integration }
	const remediationGuide: string | undefined =
		REMEDIATION_GUIDES_BY_FINDING_TYPE_ID[params?.findingTypeIdParam]

	return { remediationGuide }
}
