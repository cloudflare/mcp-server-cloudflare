import type { McpRequestContext } from '@modelcontextprotocol/server'
import type { AuthProps } from './auth-props'

export interface McpRequestSeedContext<Env> {
	/** Worker bindings for this request. */
	readonly env: Env
	/** Authenticated application props, if this endpoint uses Cloudflare auth. */
	readonly props?: AuthProps
	/** HTTP request dispatched to this fresh server. */
	readonly request: Request
	/** Original Worker execution context. */
	readonly executionCtx: ExecutionContext
	/** Bound Worker lifetime extension hook. */
	readonly waitUntil: ExecutionContext['waitUntil']
	/** SDK construction context, including protocol era and optional AuthInfo. */
	readonly mcp: McpRequestContext
}

export function getRequestUserId(props: AuthProps | undefined): string | undefined {
	return props?.type === 'user_token' ? props.user.id : undefined
}

export function requireRequestProps(context: { props?: AuthProps }): AuthProps {
	if (!context.props) {
		throw new Error('Authenticated request props are required')
	}
	return context.props
}
