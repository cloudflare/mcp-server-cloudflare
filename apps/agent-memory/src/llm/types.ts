/**
 * LLM Provider interface for agent-memory-mcp
 *
 * Abstracts the LLM backend to allow swapping between Workers AI,
 * Replicate, or other providers in the future.
 */

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string
	/** Tool calls made by an assistant message. */
	tool_calls?: LLMToolCall[]
	/** Tool call ID for tool responses. */
	tool_call_id?: string
}

/**
 * Tool definition for function calling
 */
export interface LLMTool {
	name: string
	description: string
	parameters: {
		type: 'object'
		properties: Record<
			string,
			{
				type: string
				description: string
				enum?: string[]
			}
		>
		required?: string[]
	}
}

/**
 * Tool call from LLM response
 */
export interface LLMToolCall {
	/** Provider-generated ID used to pair the call with its result. */
	id: string
	name: string
	arguments: Record<string, unknown>
}

export interface LLMCompletionOptions {
	/** Maximum tokens to generate */
	maxTokens?: number
	/** Temperature (0-1) for sampling */
	temperature?: number
	/** System prompt to prepend */
	systemPrompt?: string
	/** Tools available for the LLM to call */
	tools?: LLMTool[]
}

export interface LLMCompletionResult {
	/** Generated text response */
	response: string
	/** Token usage if available */
	usage?: {
		promptTokens?: number
		completionTokens?: number
		totalTokens?: number
	}
	/** Tool calls requested by the LLM */
	toolCalls?: LLMToolCall[]
}

export interface LLMProvider {
	/**
	 * Complete a prompt with the LLM
	 * @param prompt - User prompt or array of messages
	 * @param options - Optional completion parameters
	 */
	complete(
		prompt: string | LLMMessage[],
		options?: LLMCompletionOptions
	): Promise<LLMCompletionResult>

	/** Provider name for logging */
	readonly name: string

	/** Model identifier */
	readonly model: string
}
