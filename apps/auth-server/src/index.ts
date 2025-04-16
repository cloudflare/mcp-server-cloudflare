import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
	AuthQuery,
	AuthRequestSchemaWithExtraParams,
	ValidServers,
} from '@repo/mcp-common/src/cloudflare-oauth-handler'
import { McpError } from '@repo/mcp-common/src/mcp-error'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getApp = () =>
	new Hono()
		/**
		 * OAuth Callback Endpoint
		 *
		 * This route handles the callback from Cloudflare after user authentication.
		 * It then proceeds to redirect the user to a valid server callback path (e.g /workers/observability/callback)
		 */
		.get('/oauth/callback', zValidator('query', AuthQuery), async (c) => {
			try {
				const { state, code, scope } = c.req.valid('query')
				const oauthReqInfo = AuthRequestSchemaWithExtraParams.parse(atob(state))
				if (!oauthReqInfo.clientId) {
					throw new McpError('Invalid State', 400)
				}
				const params = new URLSearchParams({
					code,
					state,
					scope,
				})

				if (!ValidServers.safeParse(oauthReqInfo.serverPath).success) {
					throw new McpError(`Invalid server redirect ${oauthReqInfo.serverPath}`, 400)
				}

				const redirectUrl = new URL(
					`${new URL(c.req.url).origin}/${oauthReqInfo.serverPath}/oauth/callback?${params.toString()}`
				)
				return Response.redirect(redirectUrl.toString(), 302)
			} catch (e) {
				console.error(e)
				if (e instanceof McpError) {
					return c.text(e.message, { status: e.code })
				}
				return c.text('Internal Error', 500)
			}
		})

export default {
	fetch: getApp().fetch,
} satisfies ExportedHandler
