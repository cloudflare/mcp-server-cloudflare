import { createAnthropic } from '@ai-sdk/anthropic'
import { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAIChatModelId } from '@ai-sdk/openai/internal'
import { createAiGateway } from 'ai-gateway-provider'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { env } from 'cloudflare:test'
import { describe } from 'vitest'
import { createWorkersAI } from 'workers-ai-provider'
import { GoogleGenerativeAILanguageModel } from '@ai-sdk/google/internal'

export const factualityModel = getOpenAiModel('gpt-4o')

type value2key<T, V> = {
	[K in keyof T]: T[K] extends V ? K : never
}[keyof T]
type AiTextGenerationModels = Exclude<
	value2key<AiModels, BaseAiTextGeneration>,
	value2key<AiModels, BaseAiTextToImage>
>

function getOpenAiModel(modelName: OpenAIChatModelId) {
	if (!env.OPENAI_API_KEY) {
		throw new Error('No API token set!')
	}
	const ai = createOpenAI({
		apiKey: env.OPENAI_API_KEY,
	})

	const model = ai(modelName)

	return { modelName, model, ai }
}

function getAnthropicModel(modelName: AnthropicMessagesModelId) {
	if (!env.CLOUDFLARE_ACCOUNT_ID || !env.AI_GATEWAY_ID || !env.AI_GATEWAY_TOKEN) {
		throw new Error('No AI gateway credentials set!')
	}

	const aigateway = createAiGateway({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		gateway: env.AI_GATEWAY_ID,
		apiKey: env.AI_GATEWAY_TOKEN,
	});
	
	const ai = createAnthropic({
		apiKey: '',
	})

	const model = aigateway([ai(modelName)]);

	return { modelName, model, ai }
}

function getGeminiModel(modelName: GoogleGenerativeAILanguageModel['modelId']) {
	if (!env.CLOUDFLARE_ACCOUNT_ID || !env.AI_GATEWAY_ID || !env.AI_GATEWAY_TOKEN) {
		throw new Error('No AI gateway credentials set!')
	}

	const aigateway = createAiGateway({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		gateway: env.AI_GATEWAY_ID,
		apiKey: env.AI_GATEWAY_TOKEN,
	});

	const ai = createGoogleGenerativeAI({ apiKey: ''})

	const model = aigateway([ai(modelName)])

	return { modelName, model, ai }
}

function getWorkersAiModel(modelName: AiTextGenerationModels) {
	if (!env.AI) {
		throw new Error('No AI binding provided!')
	}

	const ai = createWorkersAI({ binding: env.AI })

	const model = ai(modelName)
	return { modelName, model, ai }
}

export const eachModel = describe.each([
	getOpenAiModel('gpt-4o'),
	getOpenAiModel('gpt-4o-mini'),
	getAnthropicModel('claude-3-5-sonnet-20241022'),
	getGeminiModel('gemini-2.5-pro-exp-03-25')
	// llama 3 is somewhat inconsistent
	//getWorkersAiModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
	// Currently llama 4 is having issues with tool calling
	//getWorkersAiModel("@cf/meta/llama-4-scout-17b-16e-instruct")

	// TODO: add Claude, Gemini, new OpenAI models via AI gateway
])
