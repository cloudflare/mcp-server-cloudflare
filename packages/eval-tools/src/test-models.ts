import { createAiGateway } from 'ai-gateway-provider'
import { createUnified } from 'ai-gateway-provider/providers/unified'
import { env } from 'cloudflare:workers'
import { describe } from 'vitest'

import type { LanguageModel } from 'ai'

// `cloudflare:workers` types `env` as the project-specific (here, empty) Cloudflare.Env.
// Declare the eval-runtime variables this module reads; all optional, so the assignment is safe.
interface EvalEnv {
	CLOUDFLARE_ACCOUNT_ID?: string
	AI_GATEWAY_ID?: string
	AI_GATEWAY_TOKEN?: string
}
const evalEnv: EvalEnv = env

interface EvalModel {
	modelName: string
	model: LanguageModel
}

// Every eval model is routed through the user's AI Gateway, which supplies the upstream
// provider credentials via its stored ("bring your own keys") keys — so no per-provider API
// key is needed here. Model ids are `provider/model`, e.g. `openai/gpt-5.4-mini` or
// `workers-ai/@cf/moonshotai/kimi-k2.6`.
function getGatewayModel(modelName: string): EvalModel {
	if (!evalEnv.CLOUDFLARE_ACCOUNT_ID || !evalEnv.AI_GATEWAY_ID || !evalEnv.AI_GATEWAY_TOKEN) {
		throw new Error('No AI gateway credentials set!')
	}

	const aigateway = createAiGateway({
		accountId: evalEnv.CLOUDFLARE_ACCOUNT_ID,
		gateway: evalEnv.AI_GATEWAY_ID,
		apiKey: evalEnv.AI_GATEWAY_TOKEN,
	})
	const unified = createUnified()

	return { modelName, model: aigateway(unified(modelName)) }
}

// gpt-5.4-nano judges the factuality of each subject model's tool use.
export const factualityModel = getGatewayModel('openai/gpt-5.4-nano')

// The subject models every eval is run against.
export const eachModel = describe.each([
	getGatewayModel('openai/gpt-5.4-mini'),
	getGatewayModel('openai/gpt-4.1'),
	getGatewayModel('workers-ai/@cf/moonshotai/kimi-k2.6'),
])
