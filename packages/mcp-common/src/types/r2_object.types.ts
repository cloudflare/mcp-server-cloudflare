/**
 * This file contains the validators for the R2 object tools.
 */
import { z } from 'zod'

import { BucketNameSchema } from './r2_bucket.types'

// Re-export bucket name for convenience
export { BucketNameSchema }

// Jurisdiction for object operations - only needed when buckets share the same name across jurisdictions
export const BucketJurisdictionSchema = z
	.enum(['default', 'eu', 'fedramp'])
	.optional()
	.describe(
		'Only needed if you have multiple buckets with the same name in different jurisdictions.'
	)

// Object key schemas
export const ObjectKeySchema = z
	.string()
	.min(1)
	.describe('The key (path) of the object in the bucket')

export const ObjectKeysSchema = z
	.array(z.string().min(1))
	.min(1)
	.max(1000)
	.describe('Array of object keys to delete (max 1000)')

// Storage and content schemas
export const StorageClassSchema = z
	.enum(['Standard', 'InfrequentAccess'])
	.optional()
	.describe('Storage class')

export const ContentTypeSchema = z
	.string()
	.optional()
	.describe('MIME type of the object (e.g., "text/plain", "image/png")')

export const ContentEncodingSchema = z
	.string()
	.optional()
	.describe('Content encoding (e.g., "gzip", "br")')

export const ContentDispositionSchema = z
	.string()
	.optional()
	.describe('Content disposition (e.g., "attachment; filename=example.txt")')

export const ContentLanguageSchema = z
	.string()
	.optional()
	.describe('Content language (e.g., "en-US")')

export const CacheControlSchema = z
	.string()
	.optional()
	.describe('Cache control header (e.g., "max-age=3600")')

export const ExpiresSchema = z
	.string()
	.optional()
	.describe('Expiration date in RFC 2822 or ISO 8601 format')

// Content for upload
export const ObjectContentSchema = z
	.string()
	.describe('The content of the object (text or base64-encoded)')

export const Base64EncodedSchema = z
	.boolean()
	.optional()
	.default(false)
	.describe('If true, the content is base64-encoded and will be decoded before upload')

// Size limit for get operations (10MB)
export const MAX_OBJECT_SIZE_BYTES = 10 * 1024 * 1024

// Size limit for upload operations (100MB)
export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024
