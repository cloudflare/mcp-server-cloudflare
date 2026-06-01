import { isPromise } from 'node:util/types'
import { type ServerOptions } from '@modelcontextprotocol/sdk/server/index.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ZodRawShape } from 'zod'

import { MetricsTracker, SessionStart, ToolCall } from '../../mcp-observability/src'
import { buildAccountTool } from './account-tool'
import { McpError } from './mcp-error'

import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type {
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js'
import type { AccountManager } from './account-manager'
import type { AccountToolCallback } from './account-tool'
import type { SentryClient } from './sentry'

export type { AccountToolCallback } from './account-tool'

export class CloudflareMCPServer extends McpServer {
	private metrics
	private sentry?: SentryClient
	private accountManager?: AccountManager

	constructor({
		userId,
		wae,
		serverInfo,
		options,
		sentry,
		accountManager,
	}: {
		userId?: string
		wae: AnalyticsEngineDataset
		serverInfo: {
			[x: string]: unknown
			name: string
			version: string
		}
		options?: ServerOptions
		sentry?: SentryClient
		/** Enables {@link CloudflareMCPServer.accountTool}; required to register account-scoped tools. */
		accountManager?: AccountManager
	}) {
		super(serverInfo, options)
		this.metrics = new MetricsTracker(wae, serverInfo)
		this.sentry = sentry
		this.accountManager = accountManager

		this.server.oninitialized = () => {
			const clientInfo = this.server.getClientVersion()
			const clientCapabilities = this.server.getClientCapabilities()
			this.metrics.logEvent(
				new SessionStart({
					userId,
					clientInfo,
					clientCapabilities,
				})
			)
		}

		this.server.onerror = (e) => {
			this.recordError(e)
		}

		// Wrap a tool callback to record success/error metrics. Shared by the tool() and
		// registerTool() overrides so every registration path is tracked identically.
		const trackCb = (
			name: string,
			toolCb: ToolCallback<ZodRawShape | undefined>
		): ToolCallback<ZodRawShape | undefined> => {
			return (arg1, arg2) => {
				const toolCall = toolCb(
					arg1 as { [x: string]: any } & RequestHandlerExtra<ServerRequest, ServerNotification>,
					arg2
				)
				// There are 4 cases to track:
				try {
					if (isPromise(toolCall)) {
						return toolCall
							.then((r: any) => {
								// promise succeeds
								this.metrics.logEvent(new ToolCall({ toolName: name, userId }))
								return r
							})
							.catch((e: unknown) => {
								// promise throws
								this.trackToolCallError(e, name, userId)
								throw e
							})
					} else {
						// non-promise succeeds
						this.metrics.logEvent(new ToolCall({ toolName: name, userId }))
						return toolCall
					}
				} catch (e: unknown) {
					// non-promise throws
					this.trackToolCallError(e, name, userId)
					throw e
				}
			}
		}

		const _tool = this.tool.bind(this) as (...args: unknown[]) => ReturnType<McpServer['tool']>
		this.tool = (name: string, ...rest: unknown[]): ReturnType<typeof this.tool> => {
			rest[rest.length - 1] = trackCb(
				name,
				rest[rest.length - 1] as ToolCallback<ZodRawShape | undefined>
			)
			return _tool(name, ...rest)
		}

		const _registerTool = this.registerTool.bind(this) as (
			...args: unknown[]
		) => ReturnType<McpServer['registerTool']>
		this.registerTool = (
			name: string,
			...rest: unknown[]
		): ReturnType<typeof this.registerTool> => {
			rest[rest.length - 1] = trackCb(
				name,
				rest[rest.length - 1] as ToolCallback<ZodRawShape | undefined>
			)
			return _registerTool(name, ...rest)
		}
	}

	/**
	 * Register an account-scoped tool. Centralizes the 3-layer account-ID resolution:
	 *  - When the session's account is auth-pinned (account token, or user token with one
	 *    account), no `account_id` parameter is added — the tool schema stays lean.
	 *  - For multi-account user tokens an optional `account_id` parameter is appended, and at
	 *    call time the id is resolved as: `cf-account-id` header → `account_id` argument.
	 *
	 * The resolved account id is passed to {@link handler} as its second argument. If resolution
	 * fails (multi-account with no/invalid selection) the error {@link CallToolResult} is returned
	 * and {@link handler} is never invoked.
	 */
	public accountTool<Shape extends ZodRawShape>(
		name: string,
		description: string,
		shape: Shape,
		handler: AccountToolCallback<Shape>
	): ReturnType<McpServer['tool']>
	public accountTool<Shape extends ZodRawShape>(
		name: string,
		description: string,
		shape: Shape,
		annotations: ToolAnnotations,
		handler: AccountToolCallback<Shape>
	): ReturnType<McpServer['tool']>
	public accountTool<Shape extends ZodRawShape>(
		name: string,
		description: string,
		shape: Shape,
		annotationsOrHandler: ToolAnnotations | AccountToolCallback<Shape>,
		maybeHandler?: AccountToolCallback<Shape>
	): ReturnType<McpServer['tool']> {
		const accountManager = this.accountManager
		if (!accountManager) {
			throw new Error(`accountTool("${name}") requires an accountManager on the server`)
		}

		const hasAnnotations = typeof annotationsOrHandler !== 'function'
		const annotations = (hasAnnotations ? annotationsOrHandler : {}) as ToolAnnotations
		const handler = (
			hasAnnotations ? maybeHandler : annotationsOrHandler
		) as AccountToolCallback<Shape>

		const { shape: registeredShape, callback } = buildAccountTool(accountManager, shape, handler)

		return this.registerTool(
			name,
			{ description, inputSchema: registeredShape, annotations },
			callback
		)
	}

	private trackToolCallError(e: unknown, toolName: string, userId?: string) {
		// placeholder error code
		let errorCode = -1
		if (e instanceof McpError) {
			errorCode = e.code
		}
		this.metrics.logEvent(
			new ToolCall({
				toolName,
				userId: userId,
				errorCode: errorCode,
			})
		)
	}

	public recordError(e: unknown) {
		this.sentry?.recordError(e)
	}
}
