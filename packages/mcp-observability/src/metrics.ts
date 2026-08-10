import { MetricsEvent, MetricsEventIndexIds } from './analytics-engine'

import type { ClientCapabilities } from '@modelcontextprotocol/server'

export class ToolCall extends MetricsEvent {
	constructor(
		private toolCall: {
			userId?: string
			toolName: string
			errorCode?: number
		}
	) {
		super()
	}

	toDataPoint(): AnalyticsEngineDataPoint {
		return {
			indexes: [MetricsEventIndexIds.TOOL_CALL],
			blobs: this.mapBlobs({
				blob3: this.toolCall.userId,
				blob4: this.toolCall.toolName,
			}),
			doubles: this.mapDoubles({
				double1: this.toolCall.errorCode,
			}),
		}
	}
}

/**
 * One stateless MCP request. A modern request has no initialize lifecycle, and the
 * 2025 compatibility path creates a new server for each POST, so this metric must not
 * imply that a protocol session was created.
 */
export class McpRequest extends MetricsEvent {
	constructor(
		private request: {
			userId?: string
			clientId?: string
			protocolEra: 'legacy' | 'modern'
			clientInfo?: {
				name: string
				version: string
			}
			clientCapabilities?: ClientCapabilities
		}
	) {
		super()
	}

	toDataPoint(): AnalyticsEngineDataPoint {
		return {
			indexes: [MetricsEventIndexIds.MCP_REQUEST],
			blobs: this.mapBlobs({
				blob3: this.request.userId,
				blob4: this.request.clientInfo?.name,
				blob5: this.request.clientInfo?.version,
				blob6: this.request.protocolEra,
				blob7: this.request.clientId,
			}),
			doubles: this.mapDoubles({
				double1: this.request.clientCapabilities?.roots ? 1 : 0,
				double2: this.request.clientCapabilities?.sampling ? 1 : 0,
			}),
		}
	}
}

export class AuthUser extends MetricsEvent {
	constructor(
		private authUser: {
			userId?: string
			errorMessage?: string
		}
	) {
		super()
	}

	toDataPoint(): AnalyticsEngineDataPoint {
		return {
			indexes: [MetricsEventIndexIds.AUTH_USER],
			blobs: this.mapBlobs({
				blob3: this.authUser.userId,
				blob4: this.authUser.errorMessage,
			}),
		}
	}
}
