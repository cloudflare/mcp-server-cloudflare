import { registerAIGatewayTools } from 'ai-gateway/src/tools/ai-gateway.tools'
import { registerAuditLogsTools } from 'auditlogs/src/tools/audit-logs.tools'
import { registerBrowserRenderingTools } from 'browser-rendering/src/tools/browser-rendering.tools'
import { registerCloudflareBlogTools } from 'cloudflare-blog/src/tools/cloudflare-blog.tools'
import { registerCasbTools } from 'cloudflare-one-casb/src/tools/casb.tools'
import { registerDemoDayTools } from 'demo-day/src/tools/demo-day.tools'
import { registerDexTools } from 'dex-analysis/src/tools/dex.tools'
import { registerDnsAnalyticsTools } from 'dns-analytics/src/tools/dns-analytics.tools'
import { registerDocsAISearchTools } from 'docs-ai-search/src/tools/docs-ai-search.tools'
import { registerLogpushTools } from 'logpush/src/tools/logpush.tools'
import { registerRadarTools } from 'radar/src/tools/radar.tools'
import { registerUrlScannerTools } from 'radar/src/tools/url-scanner.tools'
import { registerSandboxContainerTools } from 'sandbox-container/src/tools/sandbox-container.tools'
import { registerWorkersBindingsTools } from 'workers-bindings/src/tools/workers-bindings.tools'
import { registerWorkersBuildsTools } from 'workers-builds/src/tools/workers-builds.tools'
import { registerWorkersObservabilityTools } from 'workers-observability/src/tools/workers-observability.tools'

import { createAuthenticatedMcpApp } from '@repo/mcp-common/src/mcp-app'
import { AllScopes } from '@repo/mcp-common/src/scopes'

import type { Env } from '@repo/mcp-common/src/context'

const app = createAuthenticatedMcpApp<Env>({
	serviceHostnames: ['unified-staging.mcp.cloudflare.com', 'unified.mcp.cloudflare.com'],
	scopes: AllScopes,
	serverOptions: {
		instructions:
			'This is a unified server with tools from many Cloudflare products. Ask for a list of tools to see what is available.',
	},
	register(context) {
		// Register tools from all other servers
		registerAIGatewayTools(context)
		registerAuditLogsTools(context)
		registerBrowserRenderingTools(context)
		registerCloudflareBlogTools(context)
		registerCasbTools(context)
		registerDemoDayTools(context)
		registerDexTools(context)
		registerDnsAnalyticsTools(context)
		registerDocsAISearchTools(context)
		registerLogpushTools(context)
		registerRadarTools(context)
		registerUrlScannerTools(context)
		registerSandboxContainerTools(context)
		registerWorkersBindingsTools(context)
		registerWorkersBuildsTools(context)
		registerWorkersObservabilityTools(context)
	},
})

export const mcpHandler = app.mcpHandler

export default app.worker
