/**
 * Workers AI LLM Provider
 *
 * Uses Cloudflare Workers AI for LLM completions.
 * Supports tool calling for agentic workflows via the OpenAI-compatible
 * /v1/chat/completions endpoint.
 *
 * Models with tool calling support:
 * - @cf/moonshotai/kimi-k2.7-code (1T params, 262k context, agentic) - PRIMARY
 * - @cf/zai-org/glm-4.7-flash (fast, lightweight) - AUTO-APPLY
 * - @cf/meta/llama-3.3-70b-instruct-fp8-fast (proven reliable) - FALLBACK
 * - @cf/qwen/qwq-32b (reasoning model, no tool calling) - LEGACY
 */

import type { AiRunner } from '../ai/runner'
import type {
	LLMCompletionOptions,
	LLMCompletionResult,
	LLMMessage,
	LLMProvider,
	LLMTool,
	LLMToolCall,
} from './types'

/** OpenAI-compatible chat completion response.
 *
 * Some reasoning models (Kimi K2.7, Gemma 4, GPT-OSS, Qwen3) place their
 * deliberation in a separate `reasoning_content` field and only the final
 * answer in `content`. If the model hits `max_tokens` during reasoning,
 * `content` comes back null and the whole answer lives in
 * `reasoning_content` — which the caller has to read explicitly.
 */
interface ChatCompletionResponse {
	id: string
	object: string
	created: number
	model: string
	choices: Array<{
		index: number
		message: {
			role: string
			content: string | null
			reasoning_content?: string | null
			tool_calls?: Array<{
				id: string
				type: 'function'
				function: {
					name: string
					arguments: string
				}
			}>
		}
		finish_reason: string
	}>
	usage?: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}

/** OpenAI-compatible tool format */
interface OpenAITool {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: LLMTool['parameters']
	}
}

interface OpenAIMessage {
	role: string
	content: string
	tool_call_id?: string
	tool_calls?: Array<{
		id: string
		type: 'function'
		function: { name: string; arguments: string }
	}>
}

export class WorkersAIProvider implements LLMProvider {
	readonly name = 'workers-ai'
	readonly model: string

	constructor(
		private ai: AiRunner,
		model = '@cf/qwen/qwq-32b'
	) {
		this.model = model
	}

	async complete(
		prompt: string | LLMMessage[],
		options?: LLMCompletionOptions
	): Promise<LLMCompletionResult> {
		// Build an OpenAI-compatible message history. Multi-turn function
		// calling requires both the assistant's original tool_calls and each
		// matching tool_call_id to survive into the next request.
		const messages: OpenAIMessage[] = []

		if (options?.systemPrompt) {
			messages.push({ role: 'system', content: options.systemPrompt })
		}

		if (typeof prompt === 'string') {
			messages.push({ role: 'user', content: prompt })
		} else {
			for (const message of prompt) {
				const serialized: OpenAIMessage = { role: message.role, content: message.content }
				if (message.role === 'assistant' && message.tool_calls?.length) {
					serialized.tool_calls = message.tool_calls.map((call) => ({
						id: call.id,
						type: 'function' as const,
						function: { name: call.name, arguments: JSON.stringify(call.arguments) },
					}))
				}
				if (message.role === 'tool') {
					if (!message.tool_call_id) {
						throw new Error('Tool result message is missing tool_call_id')
					}
					serialized.tool_call_id = message.tool_call_id
				}
				messages.push(serialized)
			}
		}

		// Convert tools to OpenAI format for /v1/chat/completions endpoint
		const tools = options?.tools ? this.convertToOpenAITools(options.tools) : undefined

		// Debug: Log the request being sent
		console.log(
			JSON.stringify({
				event: 'workers_ai_request',
				model: this.model,
				messageCount: messages.length,
				toolCount: tools?.length ?? 0,
				tools: tools?.map((t) => t.function.name),
				endpoint: '/v1/chat/completions',
			})
		)

		// Use the /v1/chat/completions endpoint via the AI binding's gateway
		// This provides OpenAI-compatible tool calling support
		const response = await this.callChatCompletions(messages, tools, options)

		// Debug: Log the raw response
		console.log(
			JSON.stringify({
				event: 'workers_ai_response',
				model: this.model,
				hasContent: !!response.choices?.[0]?.message?.content,
				contentLength: response.choices?.[0]?.message?.content?.length ?? 0,
				hasReasoningContent: !!response.choices?.[0]?.message?.reasoning_content,
				reasoningContentLength: response.choices?.[0]?.message?.reasoning_content?.length ?? 0,
				hasToolCalls: !!response.choices?.[0]?.message?.tool_calls,
				toolCallCount: response.choices?.[0]?.message?.tool_calls?.length ?? 0,
				finishReason: response.choices?.[0]?.finish_reason,
			})
		)

		const choice = response.choices?.[0]
		if (!choice?.message) throw new Error('Workers AI returned no completion choice')
		// Reasoning models (Kimi K2.7, Gemma 4, GPT-OSS, etc.) sometimes return
		// the answer in reasoning_content when max_tokens runs out during
		// deliberation. Fall back so the caller never sees a silently-empty
		// response from a model that did produce useful output.
		const responseText = choice?.message?.content ?? choice?.message?.reasoning_content ?? ''

		if ((choice.message.tool_calls?.length ?? 0) > 20) {
			throw new Error('Workers AI returned more than 20 tool calls in one turn')
		}
		// Parse tool calls from OpenAI format
		const toolCalls = this.parseOpenAIToolCalls(choice.message.tool_calls)

		return {
			response: responseText,
			usage: response.usage
				? {
						promptTokens: response.usage.prompt_tokens,
						completionTokens: response.usage.completion_tokens,
						totalTokens: response.usage.total_tokens,
					}
				: undefined,
			toolCalls,
		}
	}

	/**
	 * Call the /v1/chat/completions endpoint
	 */
	private async callChatCompletions(
		messages: OpenAIMessage[],
		tools: OpenAITool[] | undefined,
		options?: LLMCompletionOptions
	): Promise<ChatCompletionResponse> {
		// Build request body. Default max_tokens is generous because reasoning
		// models (Kimi K2.7, Gemma 4, GPT-OSS, Qwen3) consume hundreds-to-thousands
		// of tokens on `reasoning_content` before the visible answer begins. At
		// 2048 they routinely exhaust budget mid-deliberation and return content:
		// null, which silently breaks any agentic loop that doesn't fall back to
		// reasoning_content.
		const body: Record<string, unknown> = {
			model: this.model,
			messages,
			max_tokens: options?.maxTokens ?? 8192,
			temperature: options?.temperature ?? 0.7,
		}

		if (tools && tools.length > 0) {
			body.tools = tools
			// Let the model decide when to use tools
			body.tool_choice = 'auto'
		}

		// Use the AI binding's run method with the special chat completions format
		// The AI binding internally routes to the /v1/chat/completions endpoint
		// when using the OpenAI-compatible request format
		const response = (await this.ai.run(this.model, body)) as unknown

		// The response from ai.run with this format should match ChatCompletionResponse
		// but we need to handle both the direct response and wrapped response formats
		if (this.isChatCompletionResponse(response)) {
			return response
		}
		if (typeof response === 'object' && response !== null && 'choices' in response) {
			throw new Error('Workers AI returned an invalid chat completion response')
		}

		// Fallback: wrap legacy response format
		const legacyResponse = response as {
			response?: string
			tool_calls?: Array<{ name: string; arguments: string | Record<string, unknown> }>
		}

		return {
			id: 'legacy',
			object: 'chat.completion',
			created: Date.now(),
			model: this.model,
			choices: [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: legacyResponse.response ?? null,
						tool_calls: legacyResponse.tool_calls?.map((tc, i) => ({
							id: `call_${i}`,
							type: 'function' as const,
							function: {
								name: tc.name,
								arguments:
									typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
							},
						})),
					},
					finish_reason: legacyResponse.tool_calls ? 'tool_calls' : 'stop',
				},
			],
		}
	}

	/**
	 * Type guard for ChatCompletionResponse
	 */
	private isChatCompletionResponse(response: unknown): response is ChatCompletionResponse {
		return (
			typeof response === 'object' &&
			response !== null &&
			'choices' in response &&
			Array.isArray((response as ChatCompletionResponse).choices) &&
			(response as ChatCompletionResponse).choices.length > 0
		)
	}

	/**
	 * Convert our flat tool format to OpenAI format
	 */
	private convertToOpenAITools(tools: LLMTool[]): OpenAITool[] {
		return tools.map((tool) => ({
			type: 'function' as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			},
		}))
	}

	/**
	 * Parse tool calls from OpenAI format
	 */
	private parseOpenAIToolCalls(
		toolCalls?: Array<{
			id: string
			type: 'function'
			function: { name: string; arguments: string }
		}>
	): LLMToolCall[] | undefined {
		if (!toolCalls || toolCalls.length === 0) {
			return undefined
		}

		return toolCalls.map((call) => {
			if (!call.id || !call.function?.name) {
				throw new Error('Workers AI returned an invalid tool call')
			}
			let parsed: unknown
			try {
				parsed = JSON.parse(call.function.arguments)
			} catch {
				throw new Error(`Workers AI returned invalid arguments for ${call.function.name}`)
			}
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error(`Workers AI returned non-object arguments for ${call.function.name}`)
			}

			return {
				id: call.id,
				name: call.function.name,
				arguments: parsed as Record<string, unknown>,
			}
		})
	}
}

/** Model presets for different use cases */
export const REFLECTION_MODELS = {
	/** Primary model for deep analysis - highest quality */
	primary: '@cf/moonshotai/kimi-k2.7-code',
	/** Fast model for quick scans and auto-apply */
	fast: '@cf/zai-org/glm-4.7-flash',
	/** Fallback if primary unavailable */
	fallback: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
	/** Legacy reasoning model (no tool calling) */
	legacy: '@cf/qwen/qwq-32b',
} as const
