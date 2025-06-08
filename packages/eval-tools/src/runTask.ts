import { type MCPClientManager } from 'agents/mcp/client'
import { generateText, jsonSchema, tool } from 'ai'
import { z } from 'zod'

import type { GenerateTextResult, LanguageModelV1, ToolCallPart, ToolSet } from 'ai'

export async function runTask(
	clientManager: MCPClientManager,
	model: LanguageModelV1,
	input: string
): Promise<{
	promptOutput: string
	fullResult: GenerateTextResult<ToolSet, never>
	toolCalls: ToolCallPart[]
}> {
	const tools = clientManager.listTools()
	const toolSet: ToolSet = tools.reduce((acc, v) => {
		if (!v.inputSchema.properties) {
			v.inputSchema.properties = {}
		}

		acc[v.name] = tool({
			parameters: jsonSchema(v.inputSchema as any),
			description: v.description,
			execute: async (args: any, opts) => {
				try {
					const res = await clientManager.callTool(
						{
							...v,
							arguments: { ...args },
						},
						z.any() as any,
						{ signal: opts.abortSignal }
					)
					return res.content
				} catch (e) {
					console.log('Error calling tool')
					console.log(e)
					return e
				}
			},
		})
		return acc
	}, {} as ToolSet)

	const res = await generateText({
		model,
		system:
			"You are an assistant responsible for evaluating the results of calling various tools. Given the user's query, use the tools available to you to answer the question.",
		tools: toolSet,
		prompt: input,
		maxRetries: 1,
		maxSteps: 10,
	})

	// convert into an LLM readable result so our factuality checker can validate tool calls
	let messagesWithTools = ''
	const toolCalls: ToolCallPart[] = []
	const response = res.response
	const messages = response.messages

	for (const message of messages) {
		for (const messagePart of message.content) {
			if (typeof messagePart === 'string') {
				messagesWithTools += `<message_content type="text">${messagePart}</message_content>`
			} else if (messagePart.type === 'tool-call') {
				messagesWithTools += `<message_content type=${messagePart.type}>
    <tool_name>${messagePart.toolName}</tool_name>
    <tool_arguments>${JSON.stringify(messagePart.args)}</tool_arguments>
</message_content>`
				toolCalls.push(messagePart)
			} else if (messagePart.type === 'text') {
				messagesWithTools += `<message_content type=${messagePart.type}>${messagePart.text}</message_content>`
			}
		}
	}

	return { promptOutput: messagesWithTools, fullResult: res, toolCalls }
}
