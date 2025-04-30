import { getUserAndAccounts } from './cloudflare-oauth-handler'

import type { McpAgent } from 'agents/mcp'
import type { AuthProps } from './cloudflare-oauth-handler'

interface RequiredEnv {
	DEV_CLOUDFLARE_EMAIL: string
	DEV_CLOUDFLARE_API_TOKEN: string
}

export async function handleDevMode<
	T extends typeof McpAgent<unknown, unknown, Record<string, unknown>>,
>(agent: T, req: Request, env: RequiredEnv, ctx: ExecutionContext) {
	const { user, accounts } = await getUserAndAccounts(env.DEV_CLOUDFLARE_API_TOKEN, {
		'X-Auth-Email': env.DEV_CLOUDFLARE_EMAIL,
		'X-Auth-Key': env.DEV_CLOUDFLARE_API_TOKEN,
	})
	ctx.props = {
		accessToken: env.DEV_CLOUDFLARE_API_TOKEN,
		user,
		accounts,
	} as AuthProps
	return agent.mount('/sse').fetch(req, env, ctx)
}
