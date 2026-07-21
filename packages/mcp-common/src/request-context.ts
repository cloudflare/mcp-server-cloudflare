import { AsyncLocalStorage } from 'node:async_hooks'
import { getMcpAuthContext } from 'agents/mcp'

import { AuthPropsSchema } from './auth-props'

import type { McpRequestContext } from '@modelcontextprotocol/server'
import type { MetricsTracker } from '@repo/mcp-observability'
import type { AccountManager } from './account-manager'
import type { AuthProps } from './auth-props'
import type { SentryClient } from './sentry'
import type { CloudflareMCPServer } from './server'

interface WorkerRequestScope<Env> {
	env: Env
	request: Request
	executionCtx: ExecutionContext
}

const workerRequestStorage = new AsyncLocalStorage<WorkerRequestScope<unknown>>()

export interface McpRequestSeedContext<Env> {
	/** Worker bindings for this request. */
	readonly env: Env
	/** Authenticated application props, if this endpoint uses Cloudflare auth. */
	readonly props?: AuthProps
	/** Account resolver derived exclusively from this request's props. */
	readonly accountManager?: AccountManager
	/** Original HTTP request. */
	readonly request: Request
	/** Original Worker execution context. */
	readonly executionCtx: ExecutionContext
	/** Bound Worker lifetime extension hook. */
	readonly waitUntil: ExecutionContext['waitUntil']
	/** SDK construction context, including protocol era and optional AuthInfo. */
	readonly mcp: McpRequestContext
}

/** Shared context captured by every tool/prompt/resource registered for one request. */
export interface McpRegistrationContext<Env> extends McpRequestSeedContext<Env> {
	readonly server: CloudflareMCPServer
	readonly sentry?: SentryClient
	readonly metrics?: MetricsTracker
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

export function getWorkerRequestScope<Env>(): WorkerRequestScope<Env> {
	const scope = workerRequestStorage.getStore()
	if (!scope) {
		throw new Error('MCP server factory ran outside createCloudflareMcpHandler request scope')
	}
	return scope as WorkerRequestScope<Env>
}

export function getRequestAuthProps(required: boolean): AuthProps | undefined {
	const rawProps = getMcpAuthContext()?.props
	if (!rawProps) {
		if (required) {
			throw new Error('Authenticated request props are required')
		}
		return undefined
	}

	const parsed = AuthPropsSchema.safeParse(rawProps)
	if (!parsed.success) {
		throw new Error('Invalid authenticated request props', { cause: parsed.error })
	}
	return parsed.data
}

export function runWithWorkerRequest<Env, T>(scope: WorkerRequestScope<Env>, callback: () => T): T {
	return workerRequestStorage.run(scope as WorkerRequestScope<unknown>, callback)
}
