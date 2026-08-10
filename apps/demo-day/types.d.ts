import type { Env } from './src/demo-day.app'

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
}
