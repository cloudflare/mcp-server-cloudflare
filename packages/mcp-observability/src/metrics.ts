import { type ClientCapabilities } from '@modelcontextprotocol/sdk/types.js'

import { MetricsEvent, MetricsEventIndexIds } from './analytics-engine'

/**
 * TODO: once there are better hooks into MCP servers, we should track the session ID
 */
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

export class SessionStart extends MetricsEvent {
	constructor(
		private session: {
			userId?: string
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
			indexes: [MetricsEventIndexIds.SESSION_START],
			blobs: this.mapBlobs({
				blob3: this.session.userId,
				blob4: this.session.clientInfo?.name,
				blob5: this.session.clientInfo?.version,
			}),
			doubles: this.mapDoubles({
				double1: this.session.clientCapabilities?.roots ? 1 : 0,
				double2: this.session.clientCapabilities?.sampling ? 1 : 0,
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
			indexes: [MetricsEventIndexIds.SESSION_START],
			blobs: this.mapBlobs({
				blob3: this.authUser.userId,
				blob4: this.authUser.errorMessage,
			}),
		}
	}
}
