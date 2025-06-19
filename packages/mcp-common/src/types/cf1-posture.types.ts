import { z } from 'zod'

const FindingCategorySchema = z.object({
	product: z.string(),
	type: z.string(),
	observation: z.string(),
})

const FindingSchema = z.object({
	id: z.string(),
	name: z.string(),
	category: FindingCategorySchema,
	description: z.string().nullable(),
	vendor: z.string(),
	severity: z.string(),
	remediation: z.any().nullable(),
	supported_gateway_policy_filters: z.any().nullable(),
})

const IntegrationSchema = z.object({
	id: z.string(),
	organization_id: z.number(),
	upgradable: z.boolean(),
	// vendor: VendorSchema,
	status: z.string(),
	// zt_enrollments: z.array(ZtEnrollmentSchema),
	// permissions: z.array(z.string()),
	last_hydrated: z.string().datetime(),
	// policy: PolicySchema,
	// created: z.string().datetime(),
	// updated: z.string().datetime(),
	// name: z.string(),
	// credential_health_status: z.string(),
	// is_paused: z.boolean(),
	// upgrade_dismissed: z.boolean(),
	// credentials_expiry: z.string().datetime().nullable(),
})

const SeverityOverrideSchema = z.object({
	created_by: z.string(),
	severity: z.string().nullable(),
})

const FindingDetail = z.object({
	id: z.string(),
	archived_count: z.number(),
	active_count: z.number(),
	instance_count: z.number(),
	latest_affliction_date: z.string().datetime(),
	finding: FindingSchema,
	integration: IntegrationSchema,
	organization_id: z.number(),
	severity_override: SeverityOverrideSchema,
	ignored: z.boolean(),
})

export const FindingsResponse = z.array(FindingDetail)
export type zReturnedFindingsResult = z.infer<typeof FindingsResponse>

// Define the field schema
const AssetFieldSchema = z.object({
	name: z.string(),
	value: z.union([
		z.string(),
		z.boolean(),
		z.number(),
		z.array(z.string()),
		z.array(
			z.object({
				url: z.string(),
				display_name: z.string(),
				casb_type: z.string(),
			})
		),
	]),
	link: z.string().nullable(),
})

// Define the category schema
const CategorySchema = z.object({
	vendor: z.string(),
	service: z.string(),
	type: z.string(),
})

// Define the asset schema
const AssetSchema = z.object({
	id: z.string().uuid(),
	external_id: z.string(),
	name: z.string(),
	link: z.string().nullable(),
	fields: z.array(AssetFieldSchema),
	category: CategorySchema,
})

// Define the DLP context schema
const DlpContextSchema = z.object({
	id: z.string().uuid(),
	profile_id: z.string().uuid(),
	entry_ids: z.array(z.string().uuid()),
	match_context_min_extent: z.null(),
	match_context_max_extent: z.null(),
	match_context_payload: z.null(),
	created: z.string().datetime(),
	updated: z.string().datetime(),
	deleted: z.null(),
})

// Define the main affliction schema
const AfflictionSchema = z.object({
	id: z.string().uuid(),
	affliction_date: z.string().datetime(),
	is_archived: z.boolean(),
	dlp_contexts: z.array(DlpContextSchema),
	supported_gateway_policy_filters: z.array(z.unknown()),
	asset: AssetSchema,
})

// Type inference
// type Affliction = z.infer<typeof AfflictionSchema>

export const FindingInstancesResponse = z.array(AfflictionSchema)
export type zReturnedFindingInstancesResult = z.infer<typeof FindingInstancesResponse>
