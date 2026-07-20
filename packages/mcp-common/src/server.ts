import {
	hostHeaderValidationResponse,
	McpServer,
	ProtocolError,
	ProtocolErrorCode,
} from '@modelcontextprotocol/server'
import { createMcpHandler as createAgentsMcpHandler } from 'agents/mcp'

import { McpRequest, ToolCall } from '@repo/mcp-observability'

import { AccountManager } from './account-manager'
import { buildAccountTool } from './account-tool'
import { McpError } from './mcp-error'
import {
	getRequestAuthProps,
	getRequestUserId,
	getWorkerRequestScope,
	runWithWorkerRequest,
} from './request-context'

import type {
	Implementation,
	McpServerFactory,
	RegisteredTool,
	ServerOptions,
	StandardSchemaWithJSON,
	ToolAnnotations,
} from '@modelcontextprotocol/server'
import type { CreateStatelessMcpHandlerOptions, StatelessMcpHandler } from 'agents/mcp'
import type { z } from 'zod'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { AccountToolCallback } from './account-tool'
import type { McpRegistrationContext, McpRequestSeedContext } from './request-context'
import type { SentryClient } from './sentry'

export type { AccountToolCallback } from './account-tool'
export type { McpRegistrationContext, McpRequestSeedContext } from './request-context'

export interface CloudflareMCPServerOptions {
	serverInfo: Implementation
	request: Request
	metrics?: MetricsTracker
	userId?: string
	sentry?: SentryClient
	accountManager?: AccountManager
	options?: ServerOptions
}

/**
 * SDK v2 server used for one stateless request. It adds request-local account
 * selection, error reporting, and tool metrics without introducing protocol state.
 */
export class CloudflareMCPServer extends McpServer {
	readonly request: Request
	private readonly metrics?: MetricsTracker
	private readonly sentry?: SentryClient
	private readonly accountManager?: AccountManager
	private readonly userId?: string

	constructor({
		serverInfo,
		request,
		metrics,
		userId,
		sentry,
		accountManager,
		options,
	}: CloudflareMCPServerOptions) {
		const accountInstructions = accountManager?.instructionsSuffix() ?? ''
		const instructions = `${options?.instructions ?? ''}${accountInstructions}` || undefined
		super(serverInfo, { ...options, ...(instructions !== undefined && { instructions }) })
		this.request = request
		this.metrics = metrics
		this.sentry = sentry
		this.accountManager = accountManager
		this.userId = userId

		this.server.onerror = (error) => this.recordError(error)

		const registerTool = this.registerTool.bind(this) as (
			name: string,
			config: Record<string, unknown>,
			callback: (...args: unknown[]) => unknown
		) => RegisteredTool

		this.registerTool = ((
			name: string,
			config: Record<string, unknown>,
			callback: (...args: unknown[]) => unknown
		) => registerTool(name, config, this.trackTool(name, callback))) as typeof this.registerTool
	}

	/**
	 * Registers an account-scoped tool. Account selection is resolved from this
	 * request only: auth-pinned account, then `cf-account-id`, then `account_id`.
	 */
	accountTool<Shape extends z.ZodRawShape>(
		name: string,
		config: {
			title?: string
			description?: string
			inputSchema: z.ZodObject<Shape>
			outputSchema?: StandardSchemaWithJSON
			annotations?: ToolAnnotations
			icons?: Array<{ src: string; mimeType?: string; sizes?: string[] }>
			_meta?: Record<string, unknown>
		},
		handler: AccountToolCallback<Shape>
	): RegisteredTool {
		if (!this.accountManager) {
			throw new Error(`accountTool("${name}") requires authenticated request props`)
		}

		const { inputSchema, callback } = buildAccountTool(
			this.accountManager,
			this.request,
			config.inputSchema,
			handler
		)
		return this.registerTool(name, { ...config, inputSchema }, callback)
	}

	recordError(error: unknown): void {
		this.sentry?.recordError(error)
	}

	private trackTool(name: string, callback: (...args: unknown[]) => unknown) {
		return async (...args: unknown[]) => {
			try {
				const result = await callback(...args)
				this.metrics?.logEvent(new ToolCall({ toolName: name, userId: this.userId }))
				return result
			} catch (error) {
				this.recordError(error)
				this.metrics?.logEvent(
					new ToolCall({
						toolName: name,
						userId: this.userId,
						errorCode: toolErrorCode(error),
					})
				)
				throw error
			}
		}
	}
}

export interface CloudflareMCPServerFactoryOptions<Env> {
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

/** Creates the fresh SDK v2 server factory shared by modern and stateless 2025 requests. */
export function createCloudflareMcpServerFactory<Env>(
	options: CloudflareMCPServerFactoryOptions<Env>
): McpServerFactory {
	return async (mcp) => {
		const worker = getWorkerRequestScope<Env>()
		const props = getRequestAuthProps(options.requireAuth ?? false)
		const accountManager = props ? new AccountManager(props) : undefined
		const seed: McpRequestSeedContext<Env> = {
			env: worker.env,
			props,
			accountManager,
			request: mcp.requestInfo ?? worker.request,
			executionCtx: worker.executionCtx,
			waitUntil: worker.executionCtx.waitUntil.bind(worker.executionCtx),
			mcp,
		}
		const sentry = await options.createSentry?.(seed)
		try {
			const serverInfo = await resolveOption(options.serverInfo, seed)
			const metrics = await options.createMetrics?.(seed, serverInfo)
			const serverOptions = options.serverOptions
				? await resolveOption(options.serverOptions, seed)
				: undefined
			const server = new CloudflareMCPServer({
				serverInfo,
				request: seed.request,
				metrics,
				userId: getRequestUserId(props),
				sentry,
				accountManager,
				options: serverOptions,
			})
			metrics?.logEvent(
				new McpRequest({
					userId: getRequestUserId(props),
					clientId: mcp.authInfo?.clientId,
					protocolEra: mcp.era,
				})
			)
			await options.register({ ...seed, server, sentry, metrics })
			return server
		} catch (error) {
			sentry?.recordError(error)
			throw error
		}
	}
}

export interface CreateCloudflareMcpHandlerOptions<Env>
	extends CloudflareMCPServerFactoryOptions<Env> {
	handler?: Omit<CreateStatelessMcpHandlerOptions, 'legacy'> & {
		/** Optional DNS-rebinding allowlist. Values are hostnames without ports. */
		allowedHostnames?: string[]
	}
}

export type CloudflareMcpHandler<Env> = Omit<StatelessMcpHandler, 'fetch'> & {
	(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
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
	const inner = createAgentsMcpHandler(createCloudflareMcpServerFactory(factoryOptions), {
		...agentsOptions,
		corsOptions: resolvedCors,
	})
	const route = agentsOptions.route ?? '/mcp'

	const fetch = async (request: Request, env: Env, ctx: ExecutionContext) => {
		if (allowedHostnames) {
			const rejection = hostHeaderValidationResponse(request, allowedHostnames)
			if (rejection) return withCors(rejection, resolvedCors)
		}
		const isMcpRoute = new URL(request.url).pathname === route
		if (isMcpRoute && request.method !== 'POST' && request.method !== 'OPTIONS') {
			return withCors(
				new Response('Method Not Allowed', {
					status: 405,
					headers: { Allow: 'POST, OPTIONS' },
				}),
				resolvedCors
			)
		}

		let boundedRequest = request
		if (isMcpRoute && request.method === 'POST') {
			const bounded = await bufferMcpRequestWithinLimit(request)
			if (bounded instanceof Response) return withCors(bounded, resolvedCors)
			boundedRequest = bounded
		}

		return runWithWorkerRequest({ env, request: boundedRequest, executionCtx: ctx }, () =>
			inner(boundedRequest, env, ctx)
		)
	}

	return Object.assign(fetch, {
		fetch,
		close: inner.close,
		notify: inner.notify,
		bus: inner.bus,
	}) as CloudflareMcpHandler<Env>
}

function toolErrorCode(error: unknown): number {
	if (error instanceof McpError || error instanceof ProtocolError) {
		return error.code
	}
	return ProtocolErrorCode.InternalError
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
