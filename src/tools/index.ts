import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { KV_TOOLS, KV_HANDLERS } from './kv'
import { R2_TOOLS, R2_HANDLERS } from './r2'
import { WORKER_TOOLS, WORKERS_HANDLERS } from './workers'
import { ANALYTICS_TOOLS, ANALYTICS_HANDLERS } from './analytics'
import { D1_TOOLS, D1_HANDLERS } from './d1'
import { WAE_TOOLS, WAE_HANDLERS } from './wae'
import { log } from '../utils/helpers'

// Debug log all tools being registered
log('WAE_TOOLS:', WAE_TOOLS)
log('All tools being registered:', [
  ...KV_TOOLS,
  ...R2_TOOLS,
  ...WORKER_TOOLS,
  ...ANALYTICS_TOOLS,
  ...D1_TOOLS,
  ...WAE_TOOLS,
])

export const TOOLS: Tool[] = [
  ...KV_TOOLS,
  ...R2_TOOLS,
  ...WORKER_TOOLS,
  ...ANALYTICS_TOOLS,
  ...D1_TOOLS,
  ...WAE_TOOLS,
]

export const HANDLERS = {
  ...KV_HANDLERS,
  ...R2_HANDLERS,
  ...WORKERS_HANDLERS,
  ...ANALYTICS_HANDLERS,
  ...D1_HANDLERS,
  ...WAE_HANDLERS,
} 