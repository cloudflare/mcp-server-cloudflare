import { hostHeaderValidationResponse, McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler as createAgentsMcpHandler } from 'agents/mcp'

import { McpRequest } from '@repo/mcp-observability'

import { AccountManager } from './account-manager'
import { AuthPropsSchema } from './auth-props'
import { createRegistrationContext } from './registration-context'
import { getRequestUserId } from './request-context'

import type { Implementation, McpServerFactory, ServerOptions } from '@modelcontextprotocol/server'
import type { CreateStatelessMcpHandlerOptions } from 'agents/mcp'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { AuthProps } from './auth-props'
import type { McpRegistrationContext } from './registration-context'
import type { McpRequestSeedContext } from './request-context'
import type { SentryClient } from './sentry'

export type { AccountToolCallback } from './account-tool'
export type { McpRegistrationContext } from './registration-context'
export type { McpRequestSeedContext } from './request-context'

export interface CloudflareMcpServerFactoryOptions<Env> {
	serverInfo:
		| Implementation
		| ((context: McpRequestSeedContext<Env>) => Implementation | Promise<Implementation>)
	/** Require and validate OAuth/API-token props before registering any tools. */
	requireAuth?: boolean
	serverOptions?:
		| ServerOptions
		| ((context: McpRequestSeedContext<Env>) => ServerOptions | Promise<ServerOptions>)
	createSentry?: (
		context: McpRequestSeedContext<Env>
	) => SentryClient | undefined | Promise<SentryClient | undefined>
	createMetrics?: (
		context: McpRequestSeedContext<Env>,
		serverInfo: Implementation
	) => MetricsTracker | undefined | Promise<MetricsTracker | undefined>
	register: (context: McpRegistrationContext<Env>) => void | Promise<void>
}

interface WorkerRequest<Env> {
	env: Env
	rawProps: unknown
	request: Request
	executionCtx: ExecutionContext
}

/** Creates the fresh SDK v2 server factory shared by modern and stateless 2025 requests. */
function createCloudflareMcpServerFactory<Env>(
	options: CloudflareMcpServerFactoryOptions<Env>,
	worker: WorkerRequest<Env>
): McpServerFactory {
	return async (mcp) => {
		const props = parseRequestAuthProps(worker.rawProps, options.requireAuth ?? false)
		const accountManager = props ? new AccountManager(props) : undefined
		const seed: McpRequestSeedContext<Env> = {
			env: worker.env,
			props,
			request: mcp.requestInfo ?? worker.request,
			executionCtx: worker.executionCtx,
			waitUntil: worker.executionCtx.waitUntil.bind(worker.executionCtx),
			mcp,
		}
		const sentry = await options.createSentry?.(seed)
		try {
			const serverInfo = await resolveOption(options.serverInfo, seed)
			const metrics = await options.createMetrics?.(seed, serverInfo)
			const configuredOptions = options.serverOptions
				? await resolveOption(options.serverOptions, seed)
				: undefined
			const accountInstructions = accountManager?.instructionsSuffix() ?? ''
			const instructions =
				`${configuredOptions?.instructions ?? ''}${accountInstructions}` || undefined
			const server = new McpServer(serverInfo, {
				...configuredOptions,
				...(instructions !== undefined && { instructions }),
			})
			const userId = getRequestUserId(props)
			const context = createRegistrationContext(seed, server, {
				accountManager,
				metrics,
				sentry,
				userId,
			})

			metrics?.logEvent(
				new McpRequest({
					userId,
					clientId: mcp.authInfo?.clientId,
					protocolEra: mcp.era,
				})
			)
			await options.register(context)
			return server
		} catch (error) {
			sentry?.recordError(error)
			throw error
		}
	}
}

export interface CreateCloudflareMcpHandlerOptions<Env>
	extends CloudflareMcpServerFactoryOptions<Env> {
	handler?: Omit<CreateStatelessMcpHandlerOptions, 'legacy'> & {
		/** Optional DNS-rebinding allowlist. Values are hostnames without ports. */
		allowedHostnames?: string[]
	}
}

export interface CloudflareMcpHandler<Env> {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
}

const MAX_MCP_REQUEST_BODY_BYTES = 4 * 1024 * 1024

const DEFAULT_CORS_HEADERS = [
	'Content-Type',
	'Accept',
	'Authorization',
	'MCP-Protocol-Version',
	'Mcp-Method',
	'Mcp-Name',
	'cf-account-id',
].join(', ')

/**
 * Creates the Worker entry point for a fresh request-scoped SDK v2 factory.
 *
 * The Agents/upstream default `legacy: "stateless"` is deliberately preserved;
 * this wrapper never changes it to `"reject"`.
 */
export function createCloudflareMcpHandler<Env>(
	options: CreateCloudflareMcpHandlerOptions<Env>
): CloudflareMcpHandler<Env> {
	const { handler: handlerOptions = {}, ...factoryOptions } = options
	if ('legacy' in handlerOptions) {
		throw new TypeError(
			'createCloudflareMcpHandler always uses the default stateless 2025 fallback; do not set legacy'
		)
	}
	const { allowedHostnames, corsOptions, ...agentsOptions } = handlerOptions
	const resolvedCors =
		corsOptions === false
			? false
			: {
					headers: DEFAULT_CORS_HEADERS,
					methods: 'POST, OPTIONS',
					exposeHeaders: 'MCP-Protocol-Version',
					...corsOptions,
				}
	const route = agentsOptions.route ?? '/mcp'

	return {
		async fetch(request, env, ctx) {
			if (allowedHostnames) {
				const rejection = hostHeaderValidationResponse(request, allowedHostnames)
				if (rejection) return withCors(rejection, resolvedCors)
			}
			if (new URL(request.url).pathname !== route) {
				return withCors(new Response('Not Found', { status: 404 }), resolvedCors)
			}
			if (request.method !== 'POST' && request.method !== 'OPTIONS') {
				return withCors(
					new Response('Method Not Allowed', {
						status: 405,
						headers: { Allow: 'POST, OPTIONS' },
					}),
					resolvedCors
				)
			}

			let boundedRequest = request
			if (request.method === 'POST') {
				const bounded = await bufferMcpRequestWithinLimit(request)
				if (bounded instanceof Response) return withCors(bounded, resolvedCors)
				boundedRequest = bounded
			}

			const handler = createAgentsMcpHandler(
				createCloudflareMcpServerFactory(factoryOptions, {
					env,
					rawProps: handlerOptions.authContext?.props ?? ctx.props,
					request: boundedRequest,
					executionCtx: ctx,
				}),
				{
					...agentsOptions,
					corsOptions: resolvedCors,
				}
			)
			return handler(boundedRequest, env, ctx)
		},
	}
}

function parseRequestAuthProps(rawProps: unknown, required: boolean): AuthProps | undefined {
	const hasProps =
		rawProps !== undefined &&
		rawProps !== null &&
		(typeof rawProps !== 'object' || Object.keys(rawProps).length > 0)
	if (!hasProps) {
		if (required) throw new Error('Authenticated request props are required')
		return undefined
	}

	const parsed = AuthPropsSchema.safeParse(rawProps)
	if (!parsed.success) {
		throw new Error('Invalid authenticated request props', { cause: parsed.error })
	}
	return parsed.data
}

async function resolveOption<Context, Value>(
	option: Value | ((context: Context) => Value | Promise<Value>),
	context: Context
): Promise<Value> {
	return typeof option === 'function'
		? (option as (context: Context) => Value | Promise<Value>)(context)
		: option
}

async function bufferMcpRequestWithinLimit(request: Request): Promise<Request | Response> {
	const contentLength = request.headers.get('content-length')
	if (contentLength !== null && Number(contentLength) > MAX_MCP_REQUEST_BODY_BYTES) {
		return requestBodyTooLargeResponse()
	}
	if (!request.body) return request

	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let size = 0
	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			size += value.byteLength
			if (size > MAX_MCP_REQUEST_BODY_BYTES) {
				await reader.cancel().catch(() => undefined)
				return requestBodyTooLargeResponse()
			}
			chunks.push(value)
		}
	} catch (error) {
		await reader.cancel().catch(() => undefined)
		throw error
	}

	const body = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new Request(request, { body })
}

function requestBodyTooLargeResponse(): Response {
	return Response.json(
		{
			jsonrpc: '2.0',
			error: {
				code: -32000,
				message: `Request body too large. Maximum size is ${MAX_MCP_REQUEST_BODY_BYTES} bytes`,
			},
			id: null,
		},
		{ status: 413 }
	)
}

function withCors(
	response: Response,
	cors:
		| false
		| {
				origin?: string
				headers?: string
				methods?: string
				exposeHeaders?: string
				maxAge?: number
		  }
): Response {
	if (cors === false) return response
	const headers = new Headers(response.headers)
	headers.set('Access-Control-Allow-Origin', cors.origin ?? '*')
	headers.set('Access-Control-Allow-Headers', cors.headers ?? DEFAULT_CORS_HEADERS)
	headers.set('Access-Control-Allow-Methods', cors.methods ?? 'POST, OPTIONS')
	if (cors.exposeHeaders) headers.set('Access-Control-Expose-Headers', cors.exposeHeaders)
	headers.set('Access-Control-Max-Age', String(cors.maxAge ?? 86400))
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}
