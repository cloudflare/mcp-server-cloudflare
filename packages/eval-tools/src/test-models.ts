import { createAnthropic } from '@ai-sdk/anthropic'
import { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { GoogleGenerativeAILanguageModel } from '@ai-sdk/google/internal'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAIChatModelId } from '@ai-sdk/openai/internal'
import { createAiGateway } from 'ai-gateway-provider'
import { env } from 'cloudflare:test'
import { describe } from 'vitest'
import { createWorkersAI } from 'workers-ai-provider'

export const factualityModel = getOpenAiModel('gpt-4o')

type value2key<T, V> = {
	[K in keyof T]: T[K] extends V ? K : never
}[keyof T]
type AiTextGenerationModels = Exclude<
	value2key<AiModels, BaseAiTextGeneration>,
	value2key<AiModels, BaseAiTextToImage>
>

function getOpenAiModel(modelName: OpenAIChatModelId) {
	if (!env.CLOUDFLARE_ACCOUNT_ID || !env.AI_GATEWAY_ID || !env.AI_GATEWAY_TOKEN) {
		throw new Error('No AI gateway credentials set!')
	}

	const aigateway = createAiGateway({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		gateway: env.AI_GATEWAY_ID,
		apiKey: env.AI_GATEWAY_TOKEN,
	})

	const ai = createOpenAI({
		apiKey: '',
	})

	const model = aigateway([ai(modelName)])

	return { modelName, model, ai }
}

function getAnthropicModel(modelName: AnthropicMessagesModelId) {
	const aigateway = createAiGateway({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		gateway: env.AI_GATEWAY_ID,
		apiKey: env.AI_GATEWAY_TOKEN,
	})

	const ai = createAnthropic({
		apiKey: '',
	})

	const model = aigateway([ai(modelName)])

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
	})

	const ai = createGoogleGenerativeAI({ apiKey: '' })

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
	// getAnthropicModel('claude-3-5-sonnet-20241022'), TODO: The evals pass with anthropic, but our rate limit is so low with AI wholesaling that we can't use it in CI because it's impossible to get a complete run with the current limits
	getGeminiModel('gemini-2.0-flash'),
	// llama 3 is somewhat inconsistent
	//getWorkersAiModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
	// Currently llama 4 is having issues with tool calling
	//getWorkersAiModel("@cf/meta/llama-4-scout-17b-16e-instruct")
])
