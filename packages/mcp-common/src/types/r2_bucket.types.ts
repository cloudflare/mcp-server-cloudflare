/**
 * This file contains the validators for the r2 bucket tools.
 */
import { z } from 'zod'

import type {
	CORSDeleteParams,
	CORSUpdateParams,
	EventNotificationDeleteParams,
	EventNotificationGetParams,
	EventNotificationUpdateParams,
	LockGetParams,
	LockUpdateParams,
	SippyGetParams,
	SippyUpdateParams,
} from 'cloudflare/resources/r2/buckets.mjs'
import type {
	CustomCreateParams,
	CustomDeleteParams,
	CustomListParams,
	CustomUpdateParams,
} from 'cloudflare/resources/r2/buckets/domains.mjs'
import type {
	ProviderParam,
	Sippy,
	SippyDeleteParams,
} from 'cloudflare/resources/r2/buckets/sippy.mjs'
import type { CustomGetParams } from 'cloudflare/resources/zero-trust/devices/policies.mjs'
import type {
	BucketCreateParams,
	TemporaryCredentialCreateParams,
} from 'cloudflare/src/resources/r2.js'
import type { CORSGetParams } from 'cloudflare/src/resources/r2/buckets.js'
import type { CustomGetResponse } from 'cloudflare/src/resources/r2/buckets/domains.js'

export const BucketNameSchema: z.ZodType<BucketCreateParams['name']> = z
	.string()
	.describe('The name of the r2 bucket')

export const BucketListCursorParam = z
	.string()
	.nullable()
	.optional()
	.describe(
		'Query param: Pagination cursor received during the last List Buckets call. R2 buckets are paginated using cursors instead of page numbers.'
	)
export const BucketListDirectionParam = z
	.enum(['asc', 'desc'])
	.nullable()
	.optional()
	.describe('Direction to order buckets')
export const BucketListNameContainsParam = z
	.string()
	.nullable()
	.optional()
	.describe(
		'Bucket names to filter by. Only buckets with this phrase in their name will be returned.'
	)
export const BucketListStartAfterParam = z
	.string()
	.nullable()
	.optional()
	.describe('Bucket name to start searching after. Buckets are ordered lexicographically.')

export const AllowedMethodsEnum: z.ZodType<CORSUpdateParams.Rule['allowed']['methods']> = z.array(
	z.union([
		z.literal('GET'),
		z.literal('PUT'),
		z.literal('POST'),
		z.literal('DELETE'),
		z.literal('HEAD'),
	])
)
export const JurisdictionEnum: z.ZodType<CORSUpdateParams['jurisdiction']> = z
	.enum(['default', 'eu', 'fedramp'])
	.describe(
		'Use Jurisdictional Restrictions when you need to ensure data is stored and processed within a jurisdiction to meet data residency requirements, including local regulations such as the GDPR or FedRAMP.'
	)

// CORS ZOD SCHEMAS
export const CorsAllowedSchema: z.ZodType<CORSUpdateParams.Rule['allowed']> = z
	.object({
		methods: AllowedMethodsEnum.describe(
			'Specifies the value for the Access-Control-Allow-Methods header'
		),
		origins: z
			.array(z.string())
			.describe('Specifies the value for the Access-Control-Allow-Origin header'),
		headers: z
			.array(z.string())
			.optional()
			.describe('Specifies the value for the Access-Control-Allow-Headers header'),
	})
	.describe('Object specifying allowed origins, methods and headers for this CORS rule')

export const CorsRuleSchema: z.ZodType<CORSUpdateParams.Rule> = z
	.object({
		allowed: CorsAllowedSchema,
		id: z.string().optional().describe('Identifier for this rule'),
		exposeHeaders: z
			.array(z.string())
			.optional()
			.describe('Headers that can be exposed back and accessed by JavaScript'),
		maxAgeSeconds: z
			.number()
			.optional()
			.describe('Time in seconds browsers can cache CORS preflight responses (max 86400)'),
	})
	.describe('Object specifying allowed origins, methods and headers for this CORS rule')

export const CorsRulesSchema: z.ZodType<Omit<CORSUpdateParams, 'account_id'>> = z
	.object({
		rules: z.array(CorsRuleSchema).optional().describe('Array of CORS rules for the bucket'),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('CORS configuration for the bucket')

export const CorsGetParamsSchema: z.ZodType<Omit<CORSGetParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for getting CORS configuration for an R2 bucket')

export const CorsDeleteParamsSchema: z.ZodType<Omit<CORSDeleteParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for deleting CORS configuration for an R2 bucket')

// TEMPORARY CREDENTIALS ZOD SCHEMAS
export const TemporaryCredentialsCreateParamsSchema: z.ZodType<
	Omit<TemporaryCredentialCreateParams, 'account_id'>
> = z
	.object({
		bucket: BucketNameSchema,
		ttlSeconds: z.number().describe('The time to live for the temporary credentials'),
		permission: z
			.enum(['admin-read-write', 'admin-read-only', 'object-read-write', 'object-read-only'])
			.describe('The permission for the temporary credentials'),
		objects: z
			.array(z.string())
			.optional()
			.describe('The objects to scope the temporary credentials to'),
		prefixes: z
			.array(z.string())
			.optional()
			.describe('The prefixes to scope the temporary credentials to'),
		parentAccessKeyId: z.string().describe('The parent access key id to use for signing'),
	})
	.describe('Temporary credentials for the bucket')

// CUSTOM DOMAIN ZOD SCHEMAS
export const CustomDomainListParamsSchema: z.ZodType<Omit<CustomListParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for listing custom domains for an R2 bucket')

export const CustomDomainNameSchema: z.ZodType<CustomGetResponse['domain']> = z
	.string()
	.describe('The custom domain')

export const CustomDomainGetParamsSchema: z.ZodType<Omit<CustomGetParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for getting a custom domain for an R2 bucket')

export const CustomDomainCreateParamsSchema: z.ZodType<Omit<CustomCreateParams, 'account_id'>> = z
	.object({
		domain: CustomDomainNameSchema,
		enabled: z
			.boolean()
			.describe(
				'Whether to enable public bucket access at the custom domain. If undefined, the domain will be enabled.'
			),
		zoneId: z.string().describe('The zone id of the custom domain'),
		minTLS: z
			.enum(['1.0', '1.1', '1.2', '1.3'])
			.optional()
			.describe(
				'The minimum TLS version the custom domain will accept for incoming connections. If not set, defaults to 1.0.'
			),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for creating a custom domain for an R2 bucket')

export const CustomDomainDeleteParamsSchema: z.ZodType<Omit<CustomDeleteParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for deleting a custom domain for an R2 bucket')

export const CustomDomainUpdateParamsSchema: z.ZodType<Omit<CustomUpdateParams, 'account_id'>> = z
	.object({
		enabled: z
			.boolean()
			.describe(
				'Whether to enable public bucket access at the custom domain. If undefined, the domain will be enabled.'
			),
		zoneId: z.string().describe('The zone id of the custom domain'),
		minTLS: z
			.enum(['1.0', '1.1', '1.2', '1.3'])
			.optional()
			.describe(
				'The minimum TLS version the custom domain will accept for incoming connections. If not set, defaults to 1.0.'
			),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for updating a custom domain for an R2 bucket')

// EVENT NOTIFICATION ZOD SCHEMAS
export const QueueIdSchema = z.string().describe('The queue id of the event notification')

const EventActionEnum = z.enum([
	'PutObject',
	'CopyObject',
	'DeleteObject',
	'CompleteMultipartUpload',
	'LifecycleDeletion',
])

export const EventNotificationRuleSchema: z.ZodType<EventNotificationUpdateParams.Rule> = z
	.object({
		actions: z
			.array(EventActionEnum)
			.describe('Array of R2 object actions that will trigger notifications'),
		description: z
			.string()
			.optional()
			.describe(
				'A description that can be used to identify the event notification rule after creation'
			),
		prefix: z
			.string()
			.optional()
			.describe('Notifications will be sent only for objects with this prefix'),
		suffix: z
			.string()
			.optional()
			.describe('Notifications will be sent only for objects with this suffix'),
	})
	.describe('Rule configuration for event notifications')

// Main EventNotificationUpdateParams schema
export const EventNotificationUpdateParamsSchema: z.ZodType<
	Omit<EventNotificationUpdateParams, 'account_id'>
> = z
	.object({
		rules: z
			.array(EventNotificationRuleSchema)
			.optional()
			.describe('Array of rules to drive notifications'),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Parameters for updating event notification configuration')

export const EventNotificationGetParamsSchema: z.ZodType<
	Omit<EventNotificationGetParams, 'account_id'>
> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for getting event notifications for an R2 bucket')

export const EventNotificationDeleteParamsSchema: z.ZodType<
	Omit<EventNotificationDeleteParams, 'account_id'>
> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for deleting event notifications for an R2 bucket')

// LOCK ZOD SCHEMAS
export const LockGetParamsSchema: z.ZodType<Omit<LockGetParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for getting locks for an R2 bucket')

// Condition: Age-based
const R2LockRuleAgeCondition: z.ZodType<LockUpdateParams.Rule.R2LockRuleAgeCondition> = z
	.object({
		maxAgeSeconds: z
			.number()
			.describe('Condition to apply a lock rule to an object for how long in seconds'),
		type: z.literal('Age').describe('Age-based condition'),
	})
	.describe('Condition to apply a lock rule to an object for how long in seconds')

// Condition: Date-based
const R2LockRuleDateCondition: z.ZodType<LockUpdateParams.Rule.R2LockRuleDateCondition> = z
	.object({
		date: z.string().describe('Condition to apply a lock rule to an object until a specific date'),
		type: z.literal('Date').describe('Date-based condition'),
	})
	.describe('Condition to apply a lock rule to an object until a specific date')

// Condition: Indefinite
const R2LockRuleIndefiniteCondition: z.ZodType<LockUpdateParams.Rule.R2LockRuleIndefiniteCondition> =
	z
		.object({
			type: z.literal('Indefinite').describe('Indefinite condition'),
		})
		.describe('Condition to apply a lock rule indefinitely')

// Union of all possible condition types
const LockRuleCondition = z
	.union([R2LockRuleAgeCondition, R2LockRuleDateCondition, R2LockRuleIndefiniteCondition])
	.describe('Condition to apply a lock rule to an object')

export const LockRuleSchema: z.ZodType<LockUpdateParams.Rule> = z
	.object({
		id: z.string().describe('Unique identifier for this rule'),
		condition: LockRuleCondition,
		enabled: z.boolean().describe('Whether or not this rule is in effect'),
		prefix: z
			.string()
			.optional()
			.describe(
				'Rule will only apply to objects/uploads in the bucket that start with the given prefix; an empty prefix can be provided to scope rule to all objects/uploads'
			),
	})
	.describe('Lock rule definition')

// Main schema
export const LockUpdateParamsSchema: z.ZodType<Omit<LockUpdateParams, 'account_id'>> = z
	.object({
		rules: z.array(LockRuleSchema).optional().describe('Body param: Optional list of lock rules'),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Lock update parameters')

// SIPPY ZOD SCHEMAS
export const SippyGetParamsSchema: z.ZodType<Omit<SippyGetParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Params for getting sippy configuration for an R2 bucket')

const ProviderParam: z.ZodType<ProviderParam> = z.literal('r2').describe('Provider parameter')

// Common destination schema for reuse
const BaseDestination: z.ZodType<Sippy.Destination> = z.object({
	accessKeyId: z
		.string()
		.optional()
		.describe(
			'ID of a Cloudflare API token. This is the value labelled "Access Key ID" when creating an API token from the R2 dashboard. Sippy will use this token when writing objects to R2, so it is best to scope this token to the bucket you\'re enabling Sippy for.'
		),
	secretAccessKey: z
		.string()
		.optional()
		.describe(
			'Value of a Cloudflare API token. This is the value labelled "Secret Access Key" when creating an API token from the R2 dashboard. Sippy will use this token when writing objects to R2, so it is best to scope this token to the bucket you\'re enabling Sippy for.'
		),
	provider: ProviderParam,
})

// AWS Source schema
const AwsSourceSchema: z.ZodType<SippyUpdateParams.R2EnableSippyAws.Source> = z
	.object({
		accessKeyId: z
			.string()
			.optional()
			.describe('Access Key ID of an IAM credential (ideally scoped to a single S3 bucket)'),
		secretAccessKey: z
			.string()
			.optional()
			.describe('Secret Access Key of an IAM credential (ideally scoped to a single S3 bucket)'),
		bucket: z.string().optional().describe('Name of the AWS S3 bucket'),
		region: z.string().optional().describe('Name of the AWS availability zone'),
		provider: z.literal('aws').optional().describe('AWS provider indicator'),
	})
	.describe('AWS S3 bucket to copy objects from')

// GCS Source schema
const GcsSourceSchema: z.ZodType<SippyUpdateParams.R2EnableSippyGcs.Source> = z
	.object({
		bucket: z.string().optional().describe('Name of the GCS bucket'),
		clientEmail: z
			.string()
			.optional()
			.describe('Client email of an IAM credential (ideally scoped to a single GCS bucket)'),
		privateKey: z
			.string()
			.optional()
			.describe('Private Key of an IAM credential (ideally scoped to a single GCS bucket)'),
		provider: z.literal('gcs').optional().describe('GCS provider indicator'),
	})
	.describe('GCS bucket to copy objects from')

// R2EnableSippyAws schema
const R2EnableSippyAwsSchema: z.ZodType<Omit<SippyUpdateParams.R2EnableSippyAws, 'account_id'>> = z
	.object({
		destination: BaseDestination.describe('R2 bucket to copy objects to').optional(),
		source: AwsSourceSchema.optional(),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Parameters to enable Sippy with AWS as source')

// R2EnableSippyGcs schema
const R2EnableSippyGcsSchema: z.ZodType<Omit<SippyUpdateParams.R2EnableSippyGcs, 'account_id'>> = z
	.object({
		destination: BaseDestination.describe('R2 bucket to copy objects to').optional(),
		source: GcsSourceSchema.optional(),
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Parameters to enable Sippy with GCS as source')

// Combined SippyUpdateParams namespace schema
export const SippyUpdateParamsSchema = z.union([R2EnableSippyAwsSchema, R2EnableSippyGcsSchema])

export const SippyDeleteParamsSchema: z.ZodType<Omit<SippyDeleteParams, 'account_id'>> = z
	.object({
		jurisdiction: JurisdictionEnum.optional(),
	})
	.describe('Parameters to delete Sippy for an R2 bucket')
