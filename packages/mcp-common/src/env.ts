import { env } from 'cloudflare:workers'

// Helper to cast env as any generic Env type
export function getEnv<Env>() {
	return env as Env
}
