import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { log } from './utils/helpers'
import { R2_HANDLERS, R2_TOOLS } from './tools/r2'
import { D1_HANDLERS, D1_TOOLS } from './tools/d1'
import { KV_HANDLERS, KV_TOOLS } from './tools/kv'
import { ANALYTICS_HANDLERS, ANALYTICS_TOOLS } from './tools/analytics'
import { WORKER_TOOLS, WORKERS_HANDLERS } from './tools/workers'
import { DURABLE_OBJECTS_HANDLERS, DURABLE_OBJECTS_TOOLS } from './tools/durable-objects'
import { QUEUES_HANDLERS, QUEUES_TOOLS } from './tools/queues'
import { WORKERS_AI_HANDLERS, WORKERS_AI_TOOLS } from './tools/workers-ai'
import { WORKFLOWS_HANDLERS, WORKFLOWS_TOOLS } from './tools/workflows'
import { TEMPLATES_HANDLERS, TEMPLATES_TOOLS } from './tools/templates'
import { WFP_HANDLERS, WFP_TOOLS } from './tools/workers-for-platforms'
import { BINDINGS_HANDLERS, BINDINGS_TOOLS } from './tools/bindings'
import { ROUTING_HANDLERS, ROUTING_TOOLS } from './tools/routing'
import { CRON_HANDLERS, CRON_TOOLS } from './tools/cron'
import { ZONES_HANDLERS, ZONES_TOOLS } from './tools/zones'
import { SECRETS_HANDLERS, SECRETS_TOOLS } from './tools/secrets'
import { VERSIONS_HANDLERS, VERSIONS_TOOLS } from './tools/versions'
import { WRANGLER_HANDLERS, WRANGLER_TOOLS } from './tools/wrangler'

// Types for Cloudflare responses

// Combine all tools

const ALL_TOOLS = [
  ...KV_TOOLS, 
  ...WORKER_TOOLS, 
  ...ANALYTICS_TOOLS, 
  ...R2_TOOLS, 
  ...D1_TOOLS,
  ...DURABLE_OBJECTS_TOOLS,
  ...QUEUES_TOOLS,
  ...WORKERS_AI_TOOLS,
  ...WORKFLOWS_TOOLS,
  ...TEMPLATES_TOOLS,
  ...WFP_TOOLS,
  ...BINDINGS_TOOLS,
  ...ROUTING_TOOLS,
  ...CRON_TOOLS,
  ...ZONES_TOOLS,
  ...SECRETS_TOOLS,
  ...VERSIONS_TOOLS,
  ...WRANGLER_TOOLS
]

// Create server
const server = new Server(
  { name: 'cloudflare', version: '1.0.0' }, // Changed from cloudflare-kv to cloudflare
  { capabilities: { tools: {} } },
)

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('Received list tools request')
  return { tools: ALL_TOOLS }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name
  log('Received tool call:', toolName)

  try {
    if (toolName in ANALYTICS_HANDLERS) {
      return await ANALYTICS_HANDLERS[toolName](request)
    }
    if (toolName in D1_HANDLERS) {
      return await D1_HANDLERS[toolName](request)
    }
    if (toolName in KV_HANDLERS) {
      return await KV_HANDLERS[toolName](request)
    }
    if (toolName in WORKERS_HANDLERS) {
      return await WORKERS_HANDLERS[toolName](request)
    }
    if (toolName in R2_HANDLERS) {
      return await R2_HANDLERS[toolName](request)
    }
    if (toolName in DURABLE_OBJECTS_HANDLERS) {
      return await DURABLE_OBJECTS_HANDLERS[toolName](request)
    }
    if (toolName in QUEUES_HANDLERS) {
      return await QUEUES_HANDLERS[toolName](request)
    }
    if (toolName in WORKERS_AI_HANDLERS) {
      return await WORKERS_AI_HANDLERS[toolName](request)
    }
    if (toolName in WORKFLOWS_HANDLERS) {
      return await WORKFLOWS_HANDLERS[toolName](request)
    }
    if (toolName in TEMPLATES_HANDLERS) {
      return await TEMPLATES_HANDLERS[toolName](request)
    }
    if (toolName in WFP_HANDLERS) {
      return await WFP_HANDLERS[toolName](request)
    }
    if (toolName in BINDINGS_HANDLERS) {
      return await BINDINGS_HANDLERS[toolName](request)
    }
    if (toolName in ROUTING_HANDLERS) {
      return await ROUTING_HANDLERS[toolName](request)
    }
    if (toolName in CRON_HANDLERS) {
      return await CRON_HANDLERS[toolName](request)
    }
    if (toolName in ZONES_HANDLERS) {
      return await ZONES_HANDLERS[toolName](request)
    }
    if (toolName in SECRETS_HANDLERS) {
      return await SECRETS_HANDLERS[toolName](request)
    }
    if (toolName in VERSIONS_HANDLERS) {
      return await VERSIONS_HANDLERS[toolName](request)
    }
    if (toolName in WRANGLER_HANDLERS) {
      return await WRANGLER_HANDLERS[toolName](request)
    }

    throw new Error(`Unknown tool: ${toolName}`)
  } catch (error) {
    log('Error handling tool call:', error)
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

// Start server
export async function main() {
  log('Starting server...')
  try {
    const transport = new StdioServerTransport()
    log('Created transport')
    await server.connect(transport)
    log('Server connected and running')
  } catch (error) {
    log('Fatal error:', error)
    process.exit(1)
  }
}
