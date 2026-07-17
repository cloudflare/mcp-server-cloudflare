import type { Env } from '../agent-memory.context'

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
}
