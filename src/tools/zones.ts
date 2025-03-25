import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { fetch } from 'undici'
import { config, log } from '../utils/helpers'
import { ToolHandlers } from '../utils/types'

// Zones & Domains tool definitions
const ZONE_LIST_TOOL: Tool = {
  name: 'zones_list',
  description: 'List all zones in your account',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

const ZONE_GET_TOOL: Tool = {
  name: 'zones_get',
  description: 'Get details about a specific zone',
  inputSchema: {
    type: 'object',
    properties: {
      zoneId: {
        type: 'string',
        description: 'ID of the zone to get details for',
      },
    },
    required: ['zoneId'],
  },
}

const DOMAIN_LIST_TOOL: Tool = {
  name: 'domain_list',
  description: 'List custom domains attached to Workers',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export const ZONES_TOOLS = [ZONE_LIST_TOOL, ZONE_GET_TOOL, DOMAIN_LIST_TOOL]

// Handler functions for Zones & Domains operations
// These functions are no longer needed as we're handling everything in the tool handlers
// We're keeping the functions for reference but not using them

// These functions are no longer needed as we're handling everything in the tool handlers directly

async function handleDomainList() {
  log('Executing domain_list')
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/domains`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    log('Domain list error:', error)
    throw new Error(`Failed to list custom domains: ${error}`)
  }

  const data = (await response.json()) as { result: any; success: boolean }
  log('Domain list success:', data)
  return data.result
}

// Export handlers
export const ZONES_HANDLERS: ToolHandlers = {
  zones_list: async (request) => {
    try {
      const input = typeof request.params.input === 'string' ? JSON.parse(request.params.input) : request.params.input || {}
      
      log('zones_list called')


      const url = `https://api.cloudflare.com/client/v4/zones`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        log('Failed to parse API response:', responseText);
        throw new Error('Invalid API response format');
      }

      if (!response.ok || !data.success) {
        const errorMessage = data.errors?.[0]?.message || responseText;
        log('Zones list API error:', errorMessage);
        return {
          toolResult: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            ],
          },
          errorMessage,
        };
      }

      log('Zones list success:', data.result);
      return {
        toolResult: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      log('Error in zones_list:', errorMessage);
      return {
        toolResult: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        },
        errorMessage,
      };
    }
  },

  zones_get: async (request) => {
    try {
      const input = request.params.input ? JSON.parse(request.params.input as string) : {}
      const { zoneId } = input

      log('zones_get called with input:', input)

      if (!zoneId) {
        throw new Error('Zone ID is required')
      }

      const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}`
      log('Fetching zone details from:', url)

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
        },
      })

      const data = (await response.json()) as { success: boolean; errors?: Array<{ message: string }>; result: any }

      if (!response.ok || !data.success) {
        log('Zone get API error:', data.errors)
        return {
          toolResult: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error: ${data.errors?.[0]?.message || 'API error'}`,
              },
            ],
          },
          errorMessage: data.errors?.[0]?.message || 'API error',
        }
      }

      log('Zone details loaded successfully')
      return {
        toolResult: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.result, null, 2),
            },
          ],
        },
      }
    } catch (error) {
      log('Error in zones_get:', error)
      return {
        toolResult: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: ${(error as Error).message}`,
            },
          ],
        },
        errorMessage: (error as Error).message,
      }
    }
  },
  domain_list: async () => {
    const result = await handleDomainList()
    return {
      toolResult: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    }
  },
}
