/**
 * Mock for the 'cloudflare' SDK package.
 * The real SDK transitively imports ReadStream from node:fs which is unavailable in workerd.
 * This mock is wired via resolve.alias in vitest.config.ts so the real module is never loaded.
 */

export class Cloudflare {
	constructor(_opts?: Record<string, unknown>) {}
}

export class APIError extends Error {
	status: number
	constructor(status: number, message?: string) {
		super(message)
		this.status = status
		this.name = 'APIError'
	}
}
