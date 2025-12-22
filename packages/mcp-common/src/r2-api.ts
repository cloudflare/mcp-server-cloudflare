/**
 * R2 Object API helpers for interacting with R2 objects via the Cloudflare REST API.
 * These functions handle raw object content (not JSON) which the Cloudflare SDK doesn't support.
 */
import { env } from 'cloudflare:workers'

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4'

/**
 * Helper to get the API token, respecting dev mode
 */
function getApiToken(apiToken: string): string {
	// @ts-expect-error We don't have actual env in this package
	if (env.DEV_DISABLE_OAUTH) {
		// @ts-expect-error We don't have actual env in this package
		return env.DEV_CLOUDFLARE_API_TOKEN
	}
	return apiToken
}

/**
 * R2 object metadata returned from get operations
 */
export interface R2ObjectMetadata {
	key: string
	size: number
	etag: string
	httpMetadata: {
		contentType?: string
		contentEncoding?: string
		contentDisposition?: string
		contentLanguage?: string
		cacheControl?: string
		expires?: string
	}
	customMetadata: Record<string, string>
	uploaded: string
	storageClass: string
}

/**
 * Result of an R2 object GET operation
 */
export interface R2ObjectGetResult {
	metadata: R2ObjectMetadata
	content: string
	isBase64: boolean
}

/**
 * Fetches an R2 object content and metadata
 */
export async function fetchR2ObjectGet({
	accountId,
	bucketName,
	objectKey,
	apiToken,
	jurisdiction,
	maxSizeBytes,
}: {
	accountId: string
	bucketName: string
	objectKey: string
	apiToken: string
	jurisdiction?: string
	maxSizeBytes?: number
}): Promise<R2ObjectGetResult | null> {
	const url = `${CLOUDFLARE_API_BASE_URL}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(objectKey)}`

	const headers: Record<string, string> = {
		Authorization: `Bearer ${getApiToken(apiToken)}`,
	}

	if (jurisdiction) {
		headers['cf-r2-jurisdiction'] = jurisdiction
	}

	const response = await fetch(url, {
		method: 'GET',
		headers,
	})

	if (response.status === 404) {
		return null
	}

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`R2 GET request failed: ${error}`)
	}

	const metadata = parseR2ObjectMetadata(objectKey, response.headers)

	// Check size limit
	if (maxSizeBytes && metadata.size > maxSizeBytes) {
		throw new Error(
			`Object size (${metadata.size} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes)`
		)
	}

	// Get content and determine if it should be base64 encoded
	const contentType = metadata.httpMetadata.contentType || 'application/octet-stream'
	const isTextContent = isTextContentType(contentType)

	let content: string
	let isBase64: boolean

	if (isTextContent) {
		content = await response.text()
		isBase64 = false
	} else {
		const arrayBuffer = await response.arrayBuffer()
		content = arrayBufferToBase64(arrayBuffer)
		isBase64 = true
	}

	return { metadata, content, isBase64 }
}

/**
 * Uploads an R2 object
 */
export async function fetchR2ObjectPut({
	accountId,
	bucketName,
	objectKey,
	apiToken,
	content,
	jurisdiction,
	storageClass,
	contentType,
	contentEncoding,
	contentDisposition,
	contentLanguage,
	cacheControl,
	expires,
}: {
	accountId: string
	bucketName: string
	objectKey: string
	apiToken: string
	content: BodyInit
	jurisdiction?: string
	storageClass?: string
	contentType?: string
	contentEncoding?: string
	contentDisposition?: string
	contentLanguage?: string
	cacheControl?: string
	expires?: string
}): Promise<{ key: string; uploaded: string }> {
	const url = `${CLOUDFLARE_API_BASE_URL}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(objectKey)}`

	const headers: Record<string, string> = {
		Authorization: `Bearer ${getApiToken(apiToken)}`,
	}

	if (jurisdiction) {
		headers['cf-r2-jurisdiction'] = jurisdiction
	}
	if (storageClass) {
		headers['cf-r2-storage-class'] = storageClass
	}
	if (contentType) {
		headers['Content-Type'] = contentType
	}
	if (contentEncoding) {
		headers['Content-Encoding'] = contentEncoding
	}
	if (contentDisposition) {
		headers['Content-Disposition'] = contentDisposition
	}
	if (contentLanguage) {
		headers['Content-Language'] = contentLanguage
	}
	if (cacheControl) {
		headers['Cache-Control'] = cacheControl
	}
	if (expires) {
		headers['Expires'] = expires
	}

	const response = await fetch(url, {
		method: 'PUT',
		headers,
		body: content,
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`R2 PUT request failed: ${error}`)
	}

	return {
		key: objectKey,
		uploaded: new Date().toISOString(),
	}
}

/**
 * Deletes an R2 object
 */
export async function fetchR2ObjectDelete({
	accountId,
	bucketName,
	objectKey,
	apiToken,
	jurisdiction,
}: {
	accountId: string
	bucketName: string
	objectKey: string
	apiToken: string
	jurisdiction?: string
}): Promise<unknown> {
	const url = `${CLOUDFLARE_API_BASE_URL}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(objectKey)}`

	const headers: Record<string, string> = {
		Authorization: `Bearer ${getApiToken(apiToken)}`,
	}

	if (jurisdiction) {
		headers['cf-r2-jurisdiction'] = jurisdiction
	}

	const response = await fetch(url, {
		method: 'DELETE',
		headers,
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`R2 DELETE request failed: ${error}`)
	}

	const result = (await response.json()) as { success: boolean; errors?: Array<{ code: number; message: string }> }

	if (!result.success) {
		const errorMessage = result.errors?.[0]?.message ?? 'Unknown error'
		throw new Error(errorMessage)
	}

	return result
}

/**
 * Parse R2 object metadata from response headers
 */
function parseR2ObjectMetadata(objectKey: string, headers: Headers): R2ObjectMetadata {
	const customMetadata: Record<string, string> = {}

	// Extract custom metadata from x-amz-meta-* headers
	headers.forEach((value, key) => {
		if (key.toLowerCase().startsWith('x-amz-meta-')) {
			const metaKey = key.slice('x-amz-meta-'.length)
			customMetadata[metaKey] = value
		}
	})

	return {
		key: objectKey,
		size: parseInt(headers.get('content-length') || '0', 10),
		etag: headers.get('etag') || '',
		httpMetadata: {
			contentType: headers.get('content-type') || undefined,
			contentEncoding: headers.get('content-encoding') || undefined,
			contentDisposition: headers.get('content-disposition') || undefined,
			contentLanguage: headers.get('content-language') || undefined,
			cacheControl: headers.get('cache-control') || undefined,
			expires: headers.get('expires') || undefined,
		},
		customMetadata,
		uploaded: headers.get('last-modified') || new Date().toISOString(),
		storageClass: headers.get('x-amz-storage-class') || 'Standard',
	}
}

/**
 * Check if a content type is text-based
 */
function isTextContentType(contentType: string): boolean {
	const textTypes = [
		'text/',
		'application/json',
		'application/xml',
		'application/javascript',
		'application/typescript',
		'application/x-www-form-urlencoded',
		'application/xhtml+xml',
		'application/x-yaml',
		'application/yaml',
		'application/toml',
		'application/graphql',
		'application/ld+json',
		'application/manifest+json',
		'application/schema+json',
		'application/sql',
		'application/x-sh',
	]

	const lowerContentType = contentType.toLowerCase()
	return textTypes.some((type) => lowerContentType.startsWith(type))
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}
