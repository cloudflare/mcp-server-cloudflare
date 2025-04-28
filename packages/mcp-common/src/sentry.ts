import { APIError } from 'cloudflare'
import { Toucan, zodErrorsIntegration } from 'toucan-js'

import { McpError } from './mcp-error'

import type { BaseTransportOptions, Client, ClientOptions, Event, EventHint } from '@sentry/types'
import type { Context, Next } from 'hono'
import type { Context as SentryContext } from 'toucan-js/dist/types'
import type { MCPEnvironment } from './config'

function is5xxError(status: number): boolean {
	return status >= 500 && status <= 599
}

export class SentryClient {
	private sentry: Toucan
	constructor(sentry: Toucan) {
		this.sentry = sentry
	}

	public recordError(e: unknown) {
		if (this.sentry) {
			// ignore errors from McpError and APIError (cloudflare) that have reportToSentry = false, or aren't 5xx errors
			if (e instanceof McpError) {
				if (e.reportToSentry === false) {
					return
				}
			} else if (e instanceof APIError) {
				if (!is5xxError(e.status)) {
					return
				}
			}
			this.sentry.captureException(e)
		}
	}

	public setUser(userId: string) {
		this.sentry.setUser({ ...this.sentry.getUser(), user_id: userId })
	}
}

interface BaseBindings {
	ENVIRONMENT: MCPEnvironment
	GIT_HASH: string
	SENTRY_DSN: string
	SENTRY_ACCESS_CLIENT_ID: string
	SENTRY_ACCESS_CLIENT_SECRET: string
}

export interface BaseHonoContext {
	Bindings: BaseBindings
	Variables: {
		sentry?: SentryClient
	}
}

function initSentry<T extends BaseBindings>(
	env: T,
	ctx: SentryContext,
	req?: Request<unknown, CfProperties>
): SentryClient {
	const sentry = new Toucan({
		dsn: env.SENTRY_DSN,
		request: req,
		environment: env.ENVIRONMENT,
		context: ctx,
		release: env.GIT_HASH,
		requestDataOptions: {
			allowedHeaders: [
				'user-agent',
				'cf-challenge',
				'accept-encoding',
				'accept-language',
				'cf-ray',
				'content-length',
				'content-type',
				'host',
			],
			// Allow ONLY the “scope” param in order to avoid recording jwt, code, state and any other callback params
			allowedSearchParams: /^scope$/,
		},
		integrations: [
			zodErrorsIntegration({ saveAttachments: true }),
			{
				name: 'mcp-api-errors',
				processEvent(
					event: Event,
					_hint: EventHint,
					_client: Client<ClientOptions<BaseTransportOptions>>
				): Event {
					const processedEvent = applyMcpErrorsToEvent(event)
					return processedEvent
				},
			},
		],
		transportOptions: {
			headers: {
				'CF-Access-Client-ID': env.SENTRY_ACCESS_CLIENT_ID,
				'CF-Access-Client-Secret': env.SENTRY_ACCESS_CLIENT_SECRET,
			},
		},
	})
	return new SentryClient(sentry)
}

export function initSentryWithUser<T extends BaseBindings>(
	env: T,
	ctx: SentryContext,
	userId: string,
	req?: Request<unknown, CfProperties>
): SentryClient {
	const sentryClient = initSentry(env, ctx, req)
	sentryClient.setUser(userId)
	return sentryClient
}

export async function useSentry<T extends BaseHonoContext>(
	c: Context<T>,
	next: Next
): Promise<void> {
	c.set('sentry', initSentry(c.env, c.executionCtx, c.req.raw))
	await next()
}

export function setSentryRequestHeaders(sentry: Toucan, req: Request<unknown, CfProperties>) {
	const colo: string = req.cf && typeof req.cf.colo === 'string' ? req.cf.colo : 'UNKNOWN'
	sentry.setTag('colo', colo)

	const ip_address = req.headers.get('cf-connecting-ip') ?? ''
	const userAgent = req.headers.get('user-agent') ?? ''
	sentry.setUser({
		...sentry.getUser(),
		ip_address,
		userAgent,
		colo,
	})
}

function applyMcpErrorsToEvent(event: Event): Event {
	if (event.exception === undefined || event.exception.values === undefined) {
		return event
	}

	if (event.exception instanceof McpError) {
		try {
			return {
				...event,
				extra: {
					...event.extra,
					statusCode: event.exception.code,
					internalMessage: event.exception.internalMessage,
				},
			}
		} catch (e) {
			// Hopefully we never throw errors here, but record it
			// with the event just in case.
			return {
				...event,
				extra: {
					...event.extra,
					'McpError sentry integration parse error': {
						message: `an exception was thrown while processing McpError within applyMcpErrorsToEvent()`,
						error: e instanceof Error ? `${e.name}: ${e.cause}\n${e.stack}` : 'unknown',
					},
				},
			}
		}
	}

	return event
}
