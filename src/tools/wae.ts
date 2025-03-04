import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { fetch } from 'undici'
import { config, log } from '../utils/helpers'
import { ToolHandlers } from '../utils/types'
import z from 'zod'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const WAE_QUERY_TOOL: Tool = {
  name: 'wae_query',
  description: 'Query Workers Analytics Engine data using SQL',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL query to execute against Analytics Engine'
      },
      dataset: {
        type: 'string',
        description: 'Name of the Analytics Engine dataset'
      }
    },
    required: ['query', 'dataset']
  }
}

// Debug log when module loads
log('Initializing WAE tools...')

export const WAE_TOOLS: Tool[] = [
  WAE_QUERY_TOOL
]

log('WAE_TOOLS initialized:', WAE_TOOLS)

interface WAEColumn {
  name: string
  type: string
}

interface WAEResponse {
  meta: WAEColumn[]
  data: Record<string, any>[]
  rows: number
  rows_before_limit_at_least: number
  error?: string
}

async function queryWAE(dataset: string, query: string) {
  if (!config.accountId || !config.apiToken) {
    throw new Error('Missing required Cloudflare credentials')
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/analytics_engine/sql`
  
  log('Querying Workers Analytics Engine:', { dataset, query, url })

  try {
    // Format query to use the dataset if not already specified
    const fullQuery = query.toLowerCase().includes('from') ? 
      query : 
      `${query} FROM ${dataset}`
    
    log('Final query:', fullQuery)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'text/plain'
      },
      body: fullQuery
    })

    log('Response status:', response.status)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    const text = await response.text()
    log('Raw WAE response:', text)

    try {
      // Parse the response, handling the formatted JSON
      const rawData = JSON.parse(text)
      
      // Validate response structure
      if (!rawData.meta || !Array.isArray(rawData.meta)) {
        throw new Error('Invalid response format: missing or invalid meta field')
      }

      if (rawData.error) {
        throw new Error(rawData.error)
      }

      // Ensure data is an array
      if (!Array.isArray(rawData.data)) {
        throw new Error('Invalid response format: data field is not an array')
      }

      // Convert array data to object format if needed
      const formattedData = rawData.data.map((row: any) => {
        if (typeof row === 'object' && !Array.isArray(row)) {
          return row
        }
        // If row is an array, convert it to object using meta columns
        const formattedRow: Record<string, any> = {}
        rawData.meta.forEach((col: WAEColumn, index: number) => {
          formattedRow[col.name] = row[index]
        })
        return formattedRow
      })

      const result: WAEResponse = {
        meta: rawData.meta,
        data: formattedData,
        rows: rawData.rows || formattedData.length,
        rows_before_limit_at_least: rawData.rows_before_limit_at_least || formattedData.length
      }

      return result
    } catch (parseError) {
      log('Parse error:', parseError)
      if (parseError instanceof Error) {
        log('Parse error stack:', parseError.stack)
      }
      throw new Error('Failed to parse Analytics Engine response')
    }
  } catch (error) {
    log('WAE query error:', error)
    if (error instanceof Error) {
      log('Error stack:', error.stack)
    }
    throw error
  }
}

export const WAE_HANDLERS: ToolHandlers = {
  wae_query: async (request: z.infer<typeof CallToolRequestSchema>) => {
    const { query, dataset } = request.params.arguments as {
      query: string
      dataset: string
    }

    try {
      const result = await queryWAE(dataset, query)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            meta: result.meta,
            data: result.data,
            totalRows: result.rows,
            totalRowsBeforeLimit: result.rows_before_limit_at_least
          }, null, 2)
        }],
        metadata: { 
          success: true,
          rowCount: result.rows,
          totalRowCount: result.rows_before_limit_at_least
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log('Error in WAE handler:', errorMessage)
      return {
        content: [{
          type: 'text',
          text: `Error querying WAE: ${errorMessage}`
        }],
        metadata: { 
          success: false, 
          error: errorMessage
        }
      }
    }
  }
} 