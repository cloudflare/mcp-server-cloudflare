import { createOpenAI } from '@ai-sdk/openai'
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

function getOpenAiModel(modelName: string) {
	if (!env.OPENAI_API_KEY) {
		throw new Error('No API token set!')
	}
	const ai = createOpenAI({
		apiKey: env.OPENAI_API_KEY,
	})

	const model = ai(modelName)

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

	// llama 3 is somewhat inconsistent
	//getWorkersAiModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
	// Currently llama 4 is having issues with tool calling
	//getWorkersAiModel("@cf/meta/llama-4-scout-17b-16e-instruct")

	// TODO: add Claude, Gemini, new OpenAI models via AI gateway
])
