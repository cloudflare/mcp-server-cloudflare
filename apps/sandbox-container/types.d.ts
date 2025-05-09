declare module 'cloudflare:test' {
	interface ProvidedEnv {
		OPENAI_API_KEY: 'TODO'
		AI_GATEWAY_TOKEN: string
		CLOUDFLARE_ACCOUNT_ID: string
		AI_GATEWAY_ID: string
		AI: Ai
	}
}
