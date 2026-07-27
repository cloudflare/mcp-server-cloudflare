import { z } from 'zod'

export interface StackLibrary {
	/** Stable id used in the `?libs=` URL param and as the `library` tool argument. */
	slug: string
	/** AI Search instance name within the `dev-stack` namespace. */
	instanceId: string
	name: string
	source: string
	description: string
}

/**
 * The curated Developer Stack. Each entry maps to an AI Search `web-crawler`
 * instance in the `dev-stack` namespace (account 6702657b6aa048cf3081ff3ff3c9c52f).
 */
export const STACK_LIBRARIES: StackLibrary[] = [
	{
		slug: 'cloudflare',
		instanceId: 'developers-cloudflare-com',
		name: 'Cloudflare Developer Docs',
		source: 'developers.cloudflare.com',
		description:
			'Documentation for every Cloudflare product: Workers, D1, R2, Workers AI, AI Gateway, Wrangler, DNS, SSL/TLS, WAF, Zero Trust, and more.',
	},
	{
		slug: 'cloudflare-api',
		instanceId: 'api-developer-cloudflare-com',
		name: 'Cloudflare API',
		source: 'developers.cloudflare.com/api',
		description: 'Cloudflare REST API reference: endpoints, parameters, and schemas.',
	},
	{
		slug: 'cloudflare-blog',
		instanceId: 'blog-cloudflare-com',
		name: 'Cloudflare Blog',
		source: 'blog.cloudflare.com',
		description: 'Cloudflare product announcements, deep dives, and engineering posts.',
	},
	{
		slug: 'cloudflare-community',
		instanceId: 'community-cloudflare-com',
		name: 'Cloudflare Community',
		source: 'community.cloudflare.com',
		description: 'Community forum questions, answers, and discussions.',
	},
	{
		slug: 'vite',
		instanceId: 'vite-dev',
		name: 'Vite',
		source: 'vite.dev',
		description: 'Vite frontend build tool and dev server.',
	},
	{
		slug: 'vitest',
		instanceId: 'vitest-dev',
		name: 'Vitest',
		source: 'vitest.dev',
		description: 'Vitest unit testing framework.',
	},
	{
		slug: 'astro',
		instanceId: 'docs-astro-build',
		name: 'Astro',
		source: 'docs.astro.build',
		description: 'Astro web framework for content-driven sites.',
	},
	{
		slug: 'opennext',
		instanceId: 'opennext-js-org',
		name: 'OpenNext',
		source: 'opennext.js.org',
		description: 'OpenNext, for deploying Next.js apps to Cloudflare and other serverless platforms.',
	},
	{
		slug: 'replicate',
		instanceId: 'replicate-com',
		name: 'Replicate',
		source: 'replicate.com',
		description: 'Replicate, for running and deploying machine-learning models via API.',
	},
	{
		slug: 'hono',
		instanceId: 'hono-dev-docs',
		name: 'Hono',
		source: 'hono.dev',
		description: 'Hono, a fast and lightweight web framework for the edge.',
	},
]

export const LIBRARY_BY_INSTANCE = new Map(STACK_LIBRARIES.map((l) => [l.instanceId, l]))

/**
 * Resolve a comma-separated `?libs=` value into the allowed libraries.
 * Unknown slugs are ignored; empty/absent → the whole stack.
 */
export function resolveLibraries(libsParam: string | null | undefined): StackLibrary[] {
	if (!libsParam) return STACK_LIBRARIES
	const wanted = new Set(
		libsParam
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	)
	const picked = STACK_LIBRARIES.filter((l) => wanted.has(l.slug))
	return picked.length > 0 ? picked : STACK_LIBRARIES
}

export function toPublicLibrary(l: StackLibrary) {
	return { slug: l.slug, name: l.name, source: l.source, description: l.description }
}

export const StackSearchQueryParam = z
	.string()
	.min(1)
	.describe(
		'A natural-language question or task. Be specific to retrieve the right docs, e.g. "configure a D1 binding in wrangler and query it from a Worker" rather than just "D1".'
	)
