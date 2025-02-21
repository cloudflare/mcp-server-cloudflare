import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { log } from './utils/helpers'
import { R2_HANDLERS, R2_TOOLS } from './tools/r2'
import { D1_HANDLERS, D1_TOOLS } from './tools/d1'
import { KV_HANDLERS, KV_TOOLS } from './tools/kv'
import { ANALYTICS_HANDLERS, ANALYTICS_TOOLS } from './tools/analytics'
import { WORKER_TOOLS, WORKERS_HANDLERS } from './tools/workers'

// Combine all tools
const ALL_TOOLS = [...KV_TOOLS, ...WORKER_TOOLS, ...ANALYTICS_TOOLS, ...R2_TOOLS, ...D1_TOOLS]

// Create server
const server = new Server(
  { name: 'cloudflare', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('Received list tools request')
  return {
    jsonrpc: '2.0',
    result: { tools: ALL_TOOLS }
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name
  log('Received tool call:', toolName)

  try {
    let result
    if (toolName in ANALYTICS_HANDLERS) {
      result = await ANALYTICS_HANDLERS[toolName](request)
    } else if (toolName in D1_HANDLERS) {
      result = await D1_HANDLERS[toolName](request)
    } else if (toolName in KV_HANDLERS) {
      result = await KV_HANDLERS[toolName](request)
    } else if (toolName in WORKERS_HANDLERS) {
      result = await WORKERS_HANDLERS[toolName](request)
    } else if (toolName in R2_HANDLERS) {
      result = await R2_HANDLERS[toolName](request)
    } else {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    return {
      jsonrpc: '2.0',
      result
    }
  } catch (error) {
    log('Error handling tool call:', error)
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error)
      }
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
