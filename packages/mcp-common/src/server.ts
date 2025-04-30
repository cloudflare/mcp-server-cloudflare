import { isPromise } from 'node:util/types'
import { type ServerOptions } from '@modelcontextprotocol/sdk/server/index.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ZodRawShape } from 'zod'

import { MetricsTracker, SessionStart, ToolCall } from '../../mcp-observability/src'
import { McpError } from './mcp-error'

import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js'
import type { SentryClient } from './sentry'

export class CloudflareMCPServer extends McpServer {
	private metrics
	private sentry?: SentryClient

	constructor({
		userId,
		wae,
		serverInfo,
		options,
		sentry,
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
	}) {
		super(serverInfo, options)
		this.metrics = new MetricsTracker(wae, serverInfo)
		this.sentry = sentry

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

		const _tool = this.tool.bind(this)
		this.tool = (name: string, ...rest: unknown[]): ReturnType<typeof this.tool> => {
			const toolCb = rest[rest.length - 1] as ToolCallback<ZodRawShape | undefined>
			const replacementToolCb: ToolCallback<ZodRawShape | undefined> = (arg1, arg2) => {
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
								this.metrics.logEvent(
									new ToolCall({
										toolName: name,
										userId,
									})
								)
								return r
							})
							.catch((e: unknown) => {
								// promise throws
								this.trackToolCallError(e, name, userId)
								throw e
							})
					} else {
						// non-promise succeeds
						this.metrics.logEvent(
							new ToolCall({
								toolName: name,
								userId,
							})
						)
						return toolCall
					}
				} catch (e: unknown) {
					// non-promise throws
					this.trackToolCallError(e, name, userId)
					throw e
				}
			}
			rest[rest.length - 1] = replacementToolCb

			// @ts-ignore
			return _tool(name, ...rest)
		}
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
