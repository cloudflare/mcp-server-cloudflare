import mime from 'mime'

import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { getProps } from '../get-props'
import {
	base64ToUint8Array,
	fetchR2ObjectDelete,
	fetchR2ObjectGet,
	fetchR2ObjectPut,
} from '../r2-api'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent.types'
import {
	Base64EncodedSchema,
	BucketJurisdictionSchema,
	BucketNameSchema,
	CacheControlSchema,
	ContentDispositionSchema,
	ContentEncodingSchema,
	ContentLanguageSchema,
	ContentTypeSchema,
	ExpiresSchema,
	MAX_OBJECT_SIZE_BYTES,
	MAX_UPLOAD_SIZE_BYTES,
	ObjectContentSchema,
	ObjectKeySchema,
	StorageClassSchema,
} from '../types/r2_object.types'

export function registerR2ObjectTools(agent: CloudflareMcpAgent) {
	/**
	 * Tool to get an R2 object content and metadata
	 */
	agent.server.tool(
		'r2_object_get',
		`Download an object from an R2 bucket.
		Returns the object content and metadata.
		- Images are returned using MCP's native image type for direct viewing.
		- Text content (text/*, application/json, etc.) is returned as plain text.
		- Other binary content is returned as base64-encoded string.
		Maximum object size: ${MAX_OBJECT_SIZE_BYTES / 1024 / 1024}MB.
		Returns null if the object does not exist.`,
		{
			bucket: BucketNameSchema,
			key: ObjectKeySchema,
			bucketJurisdiction: BucketJurisdictionSchema,
		},
		{
			title: 'Get R2 object',
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ bucket, key, bucketJurisdiction }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}

			try {
				const props = getProps(agent)
				const result = await fetchR2ObjectGet({
					accountId: account_id,
					bucketName: bucket,
					objectKey: key,
					apiToken: props.accessToken,
					jurisdiction: bucketJurisdiction ?? undefined,
					maxSizeBytes: MAX_OBJECT_SIZE_BYTES,
				})

				if (!result) {
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({ exists: false, key }),
							},
						],
					}
				}

				const contentType = result.metadata.httpMetadata.contentType || 'application/octet-stream'
				const metadataText = JSON.stringify({
					exists: true,
					metadata: result.metadata,
				})

				// Images: use MCP's native image type
				if (contentType.startsWith('image/')) {
					return {
						content: [
							{
								type: 'text',
								text: metadataText,
							},
							{
								type: 'image',
								data: result.content,
								mimeType: contentType,
							},
						],
					}
				}

				// Text content: return inline
				if (!result.isBase64) {
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									exists: true,
									metadata: result.metadata,
									content: result.content,
								}),
							},
						],
					}
				}

				// Other binary: return base64 with metadata
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								exists: true,
								metadata: result.metadata,
								content: result.content,
								isBase64: true,
								note: 'Binary content is base64-encoded. Use wrangler r2 object get or the Cloudflare dashboard to download.',
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting R2 object: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to upload an object to an R2 bucket
	 */
	agent.server.tool(
		'r2_object_put',
		`Upload an object to an R2 bucket. Maximum upload size: ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB.

		Content-Type is auto-detected from the object key extension if not specified.

		To upload a local file:
		1. Read the file content (use your file reading capability)
		2. For text files: pass the content directly as a string
		3. For binary files (images, PDFs, etc.): base64-encode the content and set base64Encoded to true

		For files larger than ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB, use wrangler r2 object put.`,
		{
			bucket: BucketNameSchema,
			key: ObjectKeySchema,
			content: ObjectContentSchema,
			base64Encoded: Base64EncodedSchema,
			contentType: ContentTypeSchema,
			contentEncoding: ContentEncodingSchema,
			contentDisposition: ContentDispositionSchema,
			contentLanguage: ContentLanguageSchema,
			cacheControl: CacheControlSchema,
			expires: ExpiresSchema,
			storageClass: StorageClassSchema,
			bucketJurisdiction: BucketJurisdictionSchema,
		},
		{
			title: 'Upload R2 object',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({
			bucket,
			key,
			content,
			base64Encoded,
			contentType,
			contentEncoding,
			contentDisposition,
			contentLanguage,
			cacheControl,
			expires,
			storageClass,
			bucketJurisdiction,
		}) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}

			try {
				const props = getProps(agent)

				// Decode base64 content if specified
				let bodyContent: BodyInit
				if (base64Encoded) {
					bodyContent = base64ToUint8Array(content)
				} else {
					bodyContent = content
				}

				// Check size limit
				const contentSize =
					typeof bodyContent === 'string' ? bodyContent.length : bodyContent.byteLength
				if (contentSize > MAX_UPLOAD_SIZE_BYTES) {
					return {
						content: [
							{
								type: 'text',
								text: `Error: Content size (${Math.round(contentSize / 1024 / 1024)}MB) exceeds maximum upload size (${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB). Use wrangler r2 object put for larger files.`,
							},
						],
					}
				}

				// Auto-detect content type from key extension if not provided
				const detectedContentType = contentType ?? mime.getType(key) ?? undefined

				const result = await fetchR2ObjectPut({
					accountId: account_id,
					bucketName: bucket,
					objectKey: key,
					apiToken: props.accessToken,
					content: bodyContent,
					jurisdiction: bucketJurisdiction ?? undefined,
					storageClass: storageClass ?? undefined,
					contentType: detectedContentType,
					contentEncoding: contentEncoding ?? undefined,
					contentDisposition: contentDisposition ?? undefined,
					contentLanguage: contentLanguage ?? undefined,
					cacheControl: cacheControl ?? undefined,
					expires: expires ?? undefined,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								success: true,
								message: `Object uploaded successfully to ${bucket}/${key}`,
								key: result.key,
								contentType: detectedContentType ?? 'application/octet-stream',
								uploaded: result.uploaded,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error uploading R2 object: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	/**
	 * Tool to delete an object from an R2 bucket
	 */
	agent.server.tool(
		'r2_object_delete',
		`Delete an object from an R2 bucket.`,
		{
			bucket: BucketNameSchema,
			key: ObjectKeySchema,
			bucketJurisdiction: BucketJurisdictionSchema,
		},
		{
			title: 'Delete R2 object',
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ bucket, key, bucketJurisdiction }) => {
			const account_id = await agent.getActiveAccountId()
			if (!account_id) {
				return MISSING_ACCOUNT_ID_RESPONSE
			}
			try {
				const props = getProps(agent)
				const result = await fetchR2ObjectDelete({
					accountId: account_id,
					bucketName: bucket,
					objectKey: key,
					apiToken: props.accessToken,
					jurisdiction: bucketJurisdiction ?? undefined,
				})
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting R2 object: ${error instanceof Error && error.message}`,
						},
					],
				}
			}
		}
	)
}
