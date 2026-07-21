import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server'

import { ToolCall } from '@repo/mcp-observability'

import { buildAccountTool } from './account-tool'
import { McpError } from './mcp-error'

import type {
	Icon,
	McpServer,
	PromptCallback,
	RegisteredPrompt,
	RegisteredTool,
	StandardSchemaWithJSON,
	ToolAnnotations,
	ToolCallback,
} from '@modelcontextprotocol/server'
import type { z } from 'zod'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { AccountManager } from './account-manager'
import type { AccountToolCallback } from './account-tool'
import type { McpRequestSeedContext } from './request-context'
import type { SentryClient } from './sentry'

export interface ToolRegistrationConfig<
	OutputSchema extends StandardSchemaWithJSON,
	InputSchema extends StandardSchemaWithJSON | undefined,
> {
	title?: string
	description?: string
	inputSchema?: InputSchema
	outputSchema?: OutputSchema
	annotations?: ToolAnnotations
	icons?: Icon[]
	_meta?: Record<string, unknown>
}

export interface RegisterTool {
	<
		OutputSchema extends StandardSchemaWithJSON = StandardSchemaWithJSON,
		InputSchema extends StandardSchemaWithJSON | undefined = undefined,
	>(
		name: string,
		config: ToolRegistrationConfig<OutputSchema, InputSchema>,
		callback: ToolCallback<InputSchema>
	): RegisteredTool
}

interface PromptRegistrationConfig<ArgsSchema extends StandardSchemaWithJSON> {
	title?: string
	description?: string
	argsSchema?: ArgsSchema
	icons?: Icon[]
	_meta?: Record<string, unknown>
}

export interface RegisterPrompt {
	<ArgsSchema extends StandardSchemaWithJSON>(
		name: string,
		config: PromptRegistrationConfig<ArgsSchema>,
		callback: PromptCallback<ArgsSchema>
	): RegisteredPrompt
}

export interface AccountToolConfig<Shape extends z.ZodRawShape> {
	title?: string
	description?: string
	inputSchema: z.ZodObject<Shape>
	outputSchema?: StandardSchemaWithJSON
	annotations?: ToolAnnotations
	icons?: Icon[]
	_meta?: Record<string, unknown>
}

/**
 * Request-local registration seam for application tools and prompts.
 *
 * The raw SDK server stays private so observability and account selection cannot be
 * bypassed accidentally.
 */
export interface McpRegistrationContext<Env> extends McpRequestSeedContext<Env> {
	readonly registerTool: RegisterTool
	readonly registerPrompt: RegisterPrompt
	accountTool<Shape extends z.ZodRawShape>(
		name: string,
		config: AccountToolConfig<Shape>,
		handler: AccountToolCallback<Shape>
	): RegisteredTool
	recordError(error: unknown): void
}

interface RegistrationDependencies {
	accountManager?: AccountManager
	metrics?: MetricsTracker
	sentry?: SentryClient
	userId?: string
}

/** Builds the only application-facing registration interface for one fresh SDK server. */
export function createRegistrationContext<Env>(
	seed: McpRequestSeedContext<Env>,
	server: McpServer,
	{ accountManager, metrics, sentry, userId }: RegistrationDependencies
): McpRegistrationContext<Env> {
	const recordError = (error: unknown) => sentry?.recordError(error)
	const registerTool: RegisterTool = <
		OutputSchema extends StandardSchemaWithJSON = StandardSchemaWithJSON,
		InputSchema extends StandardSchemaWithJSON | undefined = undefined,
	>(
		name: string,
		config: ToolRegistrationConfig<OutputSchema, InputSchema>,
		callback: ToolCallback<InputSchema>
	): RegisteredTool =>
		server.registerTool<OutputSchema, InputSchema>(
			name,
			config,
			trackTool(name, callback, metrics, userId, recordError)
		)
	const registerPrompt: RegisterPrompt = (name, config, callback) =>
		server.registerPrompt(name, config, callback)

	server.server.onerror = recordError

	return {
		...seed,
		registerTool,
		registerPrompt,
		accountTool<Shape extends z.ZodRawShape>(
			name: string,
			config: AccountToolConfig<Shape>,
			handler: AccountToolCallback<Shape>
		) {
			if (!accountManager) {
				throw new Error(`accountTool("${name}") requires authenticated request props`)
			}

			const { inputSchema, callback } = buildAccountTool(
				accountManager,
				seed.request,
				config.inputSchema,
				handler
			)
			return registerTool(name, { ...config, inputSchema }, callback)
		},
		recordError,
	}
}

function trackTool<InputSchema extends StandardSchemaWithJSON | undefined>(
	name: string,
	callback: ToolCallback<InputSchema>,
	metrics: MetricsTracker | undefined,
	userId: string | undefined,
	recordError: (error: unknown) => void
): ToolCallback<InputSchema> {
	// ToolCallback is conditional on whether InputSchema exists. The SDK has no
	// non-conditional callable type for an instrumentation adapter, so erase that
	// distinction only while forwarding the original argument tuple.
	const invoke = callback as unknown as (...args: unknown[]) => unknown
	return (async (...args: unknown[]) => {
		try {
			const result = await invoke(...args)
			metrics?.logEvent(new ToolCall({ toolName: name, userId }))
			return result
		} catch (error) {
			recordError(error)
			metrics?.logEvent(
				new ToolCall({
					toolName: name,
					userId,
					errorCode: toolErrorCode(error),
				})
			)
			throw error
		}
	}) as unknown as ToolCallback<InputSchema>
}

function toolErrorCode(error: unknown): number {
	if (error instanceof McpError || error instanceof ProtocolError) {
		return error.code
	}
	return ProtocolErrorCode.InternalError
}
